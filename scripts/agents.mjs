// The AI agents the bridge can run: the user's own Claude Code or Codex CLI,
// each with its own login, so no API keys are involved. At most one agent is
// active; the choice is stored next to the decks (agent-settings.json) and
// applies to every AI feature (Create with AI, slide chat, document import).

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { wkndDeckCommand } from "./wknd-deck-command.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = resolve(process.env.DECK_DATA_DIR ?? join(ROOT, ".deck-builder"));
const SETTINGS_FILE = join(DATA_DIR, "agent-settings.json");
const DETECT_TTL_MS = 30_000;
const DETECT_TIMEOUT_MS = 15_000;
const ONE_SHOT_TIMEOUT_MS = 180_000;

// One-shot answers run in an empty folder, so the agent never sees a project.
const WORK_DIR = mkdtempSync(join(tmpdir(), "deck-ai-"));

// Listed, and picked by default, in this order.
export const AGENTS = {
  // Claude Code driving the deck through the wknd-deck CLI and its skill
  // instead of the MCP tools. It comes first, so it is the default. Offered
  // wherever the CLI can run: from source in a checkout, or prebuilt in the
  // desktop bundle (see ./wknd-deck-command.mjs).
  ...(wkndDeckCommand(ROOT) ? {
    "claude-cli": {
      id: "claude-cli",
      name: "Claude Code · CLI (beta)",
      command: "claude",
      installHint: "Install Claude Code, then run `claude` in Terminal to log in.",
      loginHint: "Run `claude` in Terminal and log in.",
    },
  } : {}),
  claude: {
    id: "claude",
    name: "Claude Code",
    command: "claude",
    installHint: "Install Claude Code, then run `claude` in Terminal to log in.",
    loginHint: "Run `claude` in Terminal and log in.",
  },
  codex: {
    id: "codex",
    name: "Codex",
    command: "codex",
    installHint: "Install the Codex CLI, then run `codex login` in Terminal.",
    loginHint: "Run `codex login` in Terminal.",
  },
};

export const isAgentId = (value) => typeof value === "string" && Object.hasOwn(AGENTS, value);

export const NO_AGENT_MESSAGE = "No AI agent is turned on. Turn on Claude Code or Codex in the Library's Create with AI panel.";

export class AgentError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export function agentEnv() {
  const env = { ...process.env };
  // Allow starting the bridge from a terminal inside Claude Code.
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  // Set by the desktop app to run this bridge on Electron's binary; the MCP
  // server config sets it again where it is needed.
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

// ---------------------------------------------------------------------------
// Detection: installed, version and login of each agent
// ---------------------------------------------------------------------------

function run(command, args) {
  return new Promise((resolvePromise) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timer;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ stdout, stderr, ...result });
    };
    let child;
    try {
      child = spawn(command, args, { cwd: WORK_DIR, env: agentEnv(), stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      finish({ code: null, error });
      return;
    }
    timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish({ code: null, timedOut: true });
    }, DETECT_TIMEOUT_MS);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => finish({ code: null, error }));
    child.on("close", (code) => finish({ code }));
  });
}

async function loggedIn(agent) {
  if (agent.command === "claude") {
    const result = await run("claude", ["auth", "status"]);
    try {
      const status = JSON.parse(result.stdout);
      if (typeof status?.loggedIn === "boolean") return status.loggedIn;
    } catch {
      // Older versions have no `auth status`; the login is then unknown.
    }
    return /not logged in/i.test(result.stdout + result.stderr) ? false : null;
  }
  const result = await run("codex", ["login", "status"]);
  if (result.code === 0) return true;
  return /not logged in/i.test(result.stdout + result.stderr) ? false : null;
}

async function detect(agent) {
  const base = { id: agent.id, name: agent.name };
  const version = await run(agent.command, ["--version"]);
  if (version.error?.code === "ENOENT") {
    return { ...base, installed: false, version: null, loggedIn: null, hint: agent.installHint };
  }
  const login = await loggedIn(agent);
  return {
    ...base,
    installed: true,
    version: /\d+\.\d+\.\d+[\w.-]*/.exec(version.stdout)?.[0] ?? null,
    loggedIn: login,
    hint: login === false ? agent.loginHint : null,
  };
}

let detection = { at: 0, promise: null };

export function detectAgents(refresh = false) {
  if (refresh || !detection.promise || Date.now() - detection.at > DETECT_TTL_MS) {
    detection = { at: Date.now(), promise: Promise.all(Object.values(AGENTS).map(detect)) };
  }
  return detection.promise;
}

const usable = (info) => info.installed && info.loggedIn !== false;

// ---------------------------------------------------------------------------
// Settings: which agent is active
// ---------------------------------------------------------------------------

// `undefined` while the user hasn't chosen; `null` when they turned AI off.
async function readChoice() {
  try {
    const value = JSON.parse(await readFile(SETTINGS_FILE, "utf8"));
    if (value?.active === null) return null;
    return isAgentId(value?.active) ? value.active : undefined;
  } catch {
    return undefined;
  }
}

async function writeChoice(active) {
  await mkdir(DATA_DIR, { recursive: true });
  const temporary = join(DATA_DIR, `agent-settings.${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify({ active }));
  await rename(temporary, SETTINGS_FILE);
}

// The agent used for new chats and one-shot answers. Until the user chooses,
// the first ready agent in AGENTS order (Claude Code · CLI, Claude Code, Codex).
export async function activeAgent() {
  const choice = await readChoice();
  if (choice !== undefined) return choice;
  const agents = await detectAgents();
  return (agents.find(usable) ?? agents.find((info) => info.installed))?.id ?? null;
}

export async function getAgentState({ refresh = false } = {}) {
  const agents = await detectAgents(refresh);
  return { active: await activeAgent(), agents };
}

export async function setActiveAgent(active) {
  if (active !== null) {
    if (!isAgentId(active)) throw new AgentError("Unknown AI agent.", "AGENT_UNKNOWN");
    const info = (await detectAgents(true)).find((item) => item.id === active);
    if (!info.installed) throw new AgentError(`${info.name} isn't installed on this computer. ${info.hint}`, "AGENT_NOT_INSTALLED");
    if (info.loggedIn === false) throw new AgentError(`${info.name} isn't logged in. ${info.hint}`, "AGENT_NOT_LOGGED_IN");
  }
  await writeChoice(active);
  return getAgentState();
}

// ---------------------------------------------------------------------------
// Codex: locked down to the tools we give it
// ---------------------------------------------------------------------------

// Codex features with their own tools, all off. Set through -c rather than
// --disable, so a Codex version without one of them ignores it instead of
// refusing to start.
const CODEX_FEATURES_OFF = ["shell_tool", "unified_exec", "apps", "plugins", "browser_use", "computer_use", "image_generation", "in_app_browser"];

export function codexArgs({ instructions, mcpServer }) {
  const args = [
    "--json",
    "--skip-git-repo-check",
    // The user's own config.toml may add MCP servers and tools; the login is
    // still read from CODEX_HOME.
    "--ignore-user-config",
    ...CODEX_FEATURES_OFF.flatMap((feature) => ["-c", `features.${feature}=false`]),
    "-c", 'web_search="disabled"',
    "-c", 'sandbox_mode="read-only"',
    "-c", 'approval_policy="never"',
    "-c", `developer_instructions=${JSON.stringify(instructions)}`,
  ];
  if (mcpServer) {
    // Values are TOML; JSON strings and arrays are valid TOML.
    const key = "mcp_servers.deck_builder";
    args.push(
      "-c", `${key}.command=${JSON.stringify(mcpServer.command)}`,
      "-c", `${key}.args=${JSON.stringify(mcpServer.args)}`,
      ...Object.entries(mcpServer.env ?? {}).flatMap(([name, value]) => ["-c", `${key}.env.${name}=${JSON.stringify(value)}`]),
      "-c", `${key}.required=true`,
      // Deck tools run without asking; nothing else is available.
      "-c", `${key}.default_tools_approval_mode="approve"`,
    );
  }
  return args;
}

// ---------------------------------------------------------------------------
// One-shot answers (slide chat, document import)
// ---------------------------------------------------------------------------

function notInstalled(agent) {
  return new AgentError(`${agent.name} isn't installed on this computer. ${agent.installHint}`, "AGENT_NOT_INSTALLED");
}

function runClaudeOnce(systemPrompt, prompt, timeoutMs) {
  const args = ["-p", "--output-format", "json", "--tools", "", "--strict-mcp-config", "--system-prompt", systemPrompt];
  if (process.env.AI_BRIDGE_MODEL) args.push("--model", process.env.AI_BRIDGE_MODEL);

  return new Promise((resolvePromise, reject) => {
    const child = spawn("claude", args, { cwd: WORK_DIR, env: agentEnv(), stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Claude Code took too long to answer."));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error.code === "ENOENT" ? notInstalled(AGENTS.claude) : error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Claude Code exited with code ${code}: ${(stderr || stdout).trim().slice(0, 500)}`));
        return;
      }
      try {
        const envelope = JSON.parse(stdout);
        if (envelope.is_error) throw new Error(envelope.result || "Claude Code returned an error.");
        resolvePromise(String(envelope.result ?? ""));
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.end(prompt);
  });
}

function runCodexOnce(systemPrompt, prompt, timeoutMs) {
  const args = ["exec", "--ephemeral", ...codexArgs({ instructions: systemPrompt }), "-"];

  return new Promise((resolvePromise, reject) => {
    const child = spawn("codex", args, { cwd: WORK_DIR, env: agentEnv(), stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    let answer = "";
    let failure = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Codex took too long to answer."));
    }, timeoutMs);

    createInterface({ input: child.stdout }).on("line", (line) => {
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        return;
      }
      if (event.type === "item.completed" && event.item?.type === "agent_message") answer = String(event.item.text ?? "");
      else if (event.type === "turn.failed") failure = String(event.error?.message || "Codex returned an error.");
      else if (event.type === "error" && event.message) failure ||= String(event.message);
    });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error.code === "ENOENT" ? notInstalled(AGENTS.codex) : error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && answer) resolvePromise(answer);
      else reject(new Error(`Codex ${code === 0 ? "returned no answer" : `exited with code ${code}`}: ${(failure || stderr).trim().slice(0, 500) || "no output"}`));
    });

    child.stdin.end(prompt);
  });
}

// Runs one prompt on the active agent without tools and returns its answer.
export async function runAgentOnce(systemPrompt, prompt, timeoutMs = ONE_SHOT_TIMEOUT_MS) {
  const agent = await activeAgent();
  if (!agent) throw new AgentError(NO_AGENT_MESSAGE, "NO_AGENT");
  return agent === "codex" ? runCodexOnce(systemPrompt, prompt, timeoutMs) : runClaudeOnce(systemPrompt, prompt, timeoutMs);
}
