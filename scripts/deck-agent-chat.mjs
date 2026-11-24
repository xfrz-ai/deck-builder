// "Create with AI" chats for the Library home, served by scripts/ai-bridge.mjs.
// The editor's "Ask AI" panel uses the same chats on the "claude-cli" agent,
// tied to the open deck: each message carries the deck and the slide on screen.
//
// Every user message runs one headless turn of the active agent (`claude -p`
// or `codex exec`, see ./agents.mjs) that may only call the deck_builder MCP
// tools, so it follows the same playbook as the CLI agent and builds the deck
// live through the local deck service. A chat stays with the agent it started
// with. Turns run
// independently of the browser request: the transcript is kept here, so the
// user can open the deck in the editor while it builds and come back to the
// chat later. Chats live in memory and end when the bridge restarts.

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { activeAgent, AgentError, AGENTS, agentEnv, codexArgs, getAgentState, isAgentId, NO_AGENT_MESSAGE, setActiveAgent } from "./agents.mjs";
import { deckMcpServer } from "./deck-mcp-config.mjs";
import { wkndDeckCommand, wkndDeckShim, wkndDeckSkillDir } from "./wknd-deck-command.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = resolve(process.env.DECK_DATA_DIR ?? join(ROOT, ".deck-builder"));
// A turn that builds a whole deck can take a while.
const TURN_TIMEOUT_MS = 30 * 60_000;
const MAX_CHATS = 20;
const MAX_MESSAGE_CHARS = 20_000;
// The agent runs outside the project and without built-in tools, so it can
// only reach the deck through deck_builder. One folder keeps resuming working.
const WORK_DIR = mkdtempSync(join(tmpdir(), "deck-agent-"));

const SYSTEM_PROMPT = `You are the WKND deck agent inside the "Create with AI" chat of the Deck Library, in the user's browser.
- Plan, write and build presentations only with the deck_builder tools. Call get_deck_playbook before planning a new deck and follow it: brief, one storyline approval, then write the copy and build live without asking again.
- You have no file, shell or web access. If the user shares a document, they have to paste its text into the chat.
- The new deck appears in the Library as soon as the cover is saved, and the chat shows an "Open deck" button for it. Never paste Library, editor or preview links, and never print tokens; just say the deck is ready in the Library.
- Write in the user's language. Keep replies short: plain text with simple numbered or bulleted lists, no tables or headings.`;

// The "claude-cli" agent: the same job through the wknd-deck CLI and its skill.
const CLI_SYSTEM_PROMPT = `You are the WKND deck agent inside the "Create with AI" chat of the Deck Library, in the user's browser.
- Plan, write and build presentations only with the wknd-deck command, which you run with the Bash tool. Use the wknd-deck skill before planning a new deck and follow it.
- You have no other shell commands and no web access. You may write and edit JSON spec files in ./specs/ only. If the user shares a document, they have to paste its text into the chat.
- The new deck appears in the Library as soon as the cover is saved, and the chat shows an "Open deck" button for it. Never paste Library, editor or preview links, and never print tokens; just say the deck is ready in the Library.
- Write in the user's language. Keep replies short: plain text with simple numbered or bulleted lists, no tables or headings.`;

// The editor's "Ask AI" panel on a "claude-cli" chat: one open deck, any slide.
const EDITOR_SYSTEM_PROMPT = `You are the WKND deck agent inside the "Ask AI" panel of the Deck Builder editor, in the user's browser. The user has one deck open and sees your changes on the canvas as soon as a command saves them.
- Work only with the wknd-deck command, which you run with the Bash tool, and follow the wknd-deck skill. You have no other shell commands and no web access. You may write and edit JSON spec files in ./specs/ only.
- Every message starts with an [Editor] line naming the open deck and the slide on screen. "This slide" means that slide. Work only on that deck: never create decks and never run wknd-deck open.
- These are revisions of an existing deck, so no storyline approval is needed: change what the user asks, on any slide and with any command, and keep everything else as it is. Read the deck or slide first when you need its current content.
- A slide marked manual was edited by hand. Rebuilding it drops those edits, so say so and ask before you use --replace-manual. Ask before you delete a slide.
- If the request is unclear, ask one short question instead of guessing.
- Never paste links or print tokens. Write in the user's language, in one to three short sentences of plain text.`;

// One folder per CLI chat, so `--resume` finds its session: the skill, the
// agent's specs folder and a `wknd-deck` command on PATH. The command runs
// the CLI from source, or the prebuilt one in the desktop app.
function cliWorkspace(chat) {
  const cli = wkndDeckCommand(ROOT);
  if (!cli) throw new AgentError("The wknd-deck CLI isn't part of this install. Turn on Claude Code instead.", "CLI_UNAVAILABLE");
  if (!chat.workDir) {
    chat.workDir = mkdtempSync(join(tmpdir(), "deck-agent-cli-"));
    mkdirSync(join(chat.workDir, "specs"));
    mkdirSync(join(chat.workDir, "bin"));
    const shim = join(chat.workDir, "bin", "wknd-deck");
    writeFileSync(shim, wkndDeckShim(cli, DATA_DIR));
    chmodSync(shim, 0o755);
  }
  // Copied every turn, so edits to the skill apply to the next message; files
  // taken out of the skill disappear too.
  const skill = join(chat.workDir, ".claude/skills/wknd-deck");
  rmSync(skill, { recursive: true, force: true });
  cpSync(wkndDeckSkillDir(ROOT), skill, { recursive: true });
  const env = agentEnv();
  env.PATH = `${join(chat.workDir, "bin")}:${env.PATH}`;
  env.DECK_DATA_DIR = DATA_DIR;
  return { cwd: chat.workDir, env };
}

// "wknd-deck slide add deck-… '{…}'" → "wknd-deck slide add"
function cliCommandName(command) {
  const words = String(command ?? "").trim().split(/\s+/);
  if (words[0] !== "wknd-deck") return "Bash";
  return words.slice(0, ["deck", "slide", "layouts"].includes(words[1]) && /^[a-z]+$/.test(words[2] ?? "") ? 3 : 2).join(" ");
}

/** @type {Map<string, Chat>} */
const chats = new Map();

/**
 * @typedef {{ id: string, agent: "claude" | "claude-cli" | "codex", sessionId: string | null, turns: number, events: object[], listeners: Set<import("node:http").ServerResponse>, child: import("node:child_process").ChildProcess | null, stopped: boolean, updatedAt: number, workDir: string | null, editorDeckId: string | null }} Chat
 * @typedef {{ deckId: string, slideId: string, slideNumber: number, slideCount: number }} EditorContext
 */

// Same as the deck service's idSchema (lib/deck-service/schemas.ts).
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/;

// What the editor sends with each message: the open deck and the slide on screen.
function parseEditorContext(value) {
  if (value === undefined || value === null) return null;
  const { deckId, slideId, slideNumber, slideCount } = value;
  if (typeof deckId !== "string" || !ID.test(deckId)) return undefined;
  if (typeof slideId !== "string" || !ID.test(slideId)) return undefined;
  if (!Number.isSafeInteger(slideNumber) || !Number.isSafeInteger(slideCount) || slideNumber < 1 || slideNumber > slideCount) return undefined;
  return { deckId, slideId, slideNumber, slideCount };
}

async function readConnection() {
  const value = JSON.parse(await readFile(join(DATA_DIR, "connection.json"), "utf8"));
  const url = new URL(value.url);
  const appUrl = new URL(value.appUrl);
  for (const item of [url, appUrl]) {
    if (item.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(item.hostname)) throw new Error("Invalid local origin");
  }
  return { url: url.origin, appUrl: appUrl.origin, token: String(value.token) };
}

// Whether the deck service runs, plus its connection for the Library page
// itself (and only that origin) so the home page can list the new deck.
async function status(origin) {
  try {
    const connection = await readConnection();
    const health = await fetch(`${connection.url}/health`, {
      headers: { Authorization: `Bearer ${connection.token}` },
      signal: AbortSignal.timeout(1500),
      redirect: "error",
    });
    if (!health.ok) return { deckService: false, connection: null };
    return {
      deckService: true,
      connection: origin === connection.appUrl ? { url: connection.url, token: connection.token } : null,
    };
  } catch {
    return { deckService: false, connection: null };
  }
}

const isBusy = (chat) => chat.child !== null;

function push(chat, event) {
  const entry = { seq: chat.events.length + 1, ...event };
  chat.events.push(entry);
  chat.updatedAt = Date.now();
  for (const listener of chat.listeners) listener.write(`${JSON.stringify(entry)}\n`);
}

function endListeners(chat) {
  for (const listener of chat.listeners) listener.end();
  chat.listeners.clear();
}

function createChat(agent, editorDeckId = null) {
  if (chats.size >= MAX_CHATS) {
    const idle = [...chats.values()].filter((chat) => !isBusy(chat)).sort((a, b) => a.updatedAt - b.updatedAt);
    if (idle[0]) {
      endListeners(idle[0]);
      chats.delete(idle[0].id);
    }
  }
  const chat = { id: randomUUID(), agent, sessionId: null, turns: 0, events: [], listeners: new Set(), child: null, stopped: false, updatedAt: Date.now(), workDir: null, editorDeckId };
  chats.set(chat.id, chat);
  return chat;
}

const shortToolName = (name) => String(name).replace(/^mcp__deck_builder__/, "");

function toolResultText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (typeof part?.text === "string" ? part.text : "")).join("");
  return "";
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Claude Code: `claude -p` with stream-json events, resumed by session id.
function claudeTurn(chat) {
  const cli = chat.agent === "claude-cli";
  const args = cli
    ? [
      "-p",
      "--output-format", "stream-json",
      "--verbose",
      "--strict-mcp-config",
      "--setting-sources", "project",
      // Anything not allowed below is refused without asking.
      "--permission-mode", "dontAsk",
      "--tools", "Bash,Skill,Write,Edit,Read",
      "--allowedTools", "Skill", "Bash(wknd-deck *)", "Write(./specs/**)", "Edit(./specs/**)", "Read(./specs/**)",
      "--append-system-prompt", chat.editorDeckId ? EDITOR_SYSTEM_PROMPT : CLI_SYSTEM_PROMPT,
    ]
    : [
      "-p",
      "--output-format", "stream-json",
      "--verbose",
      "--tools", "",
      "--strict-mcp-config",
      "--mcp-config", JSON.stringify({ mcpServers: { deck_builder: deckMcpServer(ROOT, DATA_DIR) } }),
      "--allowedTools", "mcp__deck_builder",
      "--append-system-prompt", SYSTEM_PROMPT,
    ];
  if (process.env.AI_BRIDGE_MODEL) args.push("--model", process.env.AI_BRIDGE_MODEL);
  if (chat.sessionId) args.push("--resume", chat.sessionId);
  const toolNames = new Map();

  const handle = (event, turn) => {
    if (event.type === "system" && event.subtype === "init" && event.session_id) {
      chat.sessionId = event.session_id;
    } else if (event.type === "assistant") {
      for (const part of event.message?.content ?? []) {
        if (part.type === "text" && part.text?.trim()) push(chat, { type: "assistant", text: part.text });
        else if (part.type === "tool_use") {
          const name = part.name === "Bash" ? cliCommandName(part.input?.command) : shortToolName(part.name);
          toolNames.set(part.id, name);
          push(chat, { type: "tool", id: part.id, name });
        }
      }
    } else if (event.type === "user") {
      for (const part of event.message?.content ?? []) {
        if (part.type !== "tool_result") continue;
        toolResult(chat, part.tool_use_id, toolNames.get(part.tool_use_id) ?? "", !part.is_error, toolResultText(part.content));
      }
    } else if (event.type === "result") {
      turn.done = true;
      if (event.session_id) chat.sessionId = event.session_id;
      if (event.is_error && !chat.stopped) push(chat, { type: "error", message: String(event.result || "Claude Code returned an error.") });
    }
  };
  return { args, handle };
}

// Codex: `codex exec --json`, continued with `codex exec resume <thread>`.
function codexTurn(chat) {
  const options = codexArgs({ instructions: SYSTEM_PROMPT, mcpServer: deckMcpServer(ROOT, DATA_DIR) });
  const args = chat.sessionId ? ["exec", "resume", ...options, chat.sessionId, "-"] : ["exec", ...options, "-"];
  // Codex numbers items per turn, so ids get the turn as prefix.
  const prefix = `${chat.turns}:`;
  const started = new Set();

  const handle = (event, turn) => {
    const item = event.item ?? {};
    if (event.type === "thread.started" && event.thread_id) {
      chat.sessionId = event.thread_id;
    } else if (event.type === "item.started" && item.type === "mcp_tool_call") {
      started.add(prefix + item.id);
      push(chat, { type: "tool", id: prefix + item.id, name: String(item.tool ?? "") });
    } else if (event.type === "item.completed" && item.type === "agent_message") {
      if (String(item.text ?? "").trim()) push(chat, { type: "assistant", text: String(item.text) });
    } else if (event.type === "item.completed" && item.type === "mcp_tool_call") {
      const id = prefix + item.id;
      const name = String(item.tool ?? "");
      if (!started.has(id)) push(chat, { type: "tool", id, name });
      toolResult(chat, id, name, item.status === "completed" && !item.error, toolResultText(item.result?.content));
    } else if (event.type === "item.completed" && item.type === "error") {
      // Warnings such as ignored settings; not for the chat.
      console.log(`  [codex] ${String(item.message ?? "").split("\n")[0]}`);
    } else if (event.type === "turn.completed") {
      turn.done = true;
    } else if (event.type === "turn.failed") {
      turn.done = true;
      if (!chat.stopped) push(chat, { type: "error", message: String(event.error?.message || "Codex returned an error.") });
    } else if (event.type === "error" && event.message) {
      turn.lastError = String(event.message);
    }
  };
  return { args, handle };
}

function toolResult(chat, id, name, succeeded, text) {
  if (name.startsWith("wknd-deck")) {
    // CLI output is text; errors start with "Error (CODE)".
    const ok = succeeded && !/^Error \(/m.test(text);
    push(chat, { type: "tool-result", id, name, ok });
    const created = name === "wknd-deck deck create" && /(deck-[0-9a-f]{32}) "([^"]*)"/.exec(text);
    if (ok && created) push(chat, { type: "deck", deckId: created[1], title: created[2] });
    return;
  }
  const result = parseJson(text);
  const ok = succeeded && result?.ok !== false;
  push(chat, { type: "tool-result", id, name, ok });
  if (ok && typeof result?.deckId === "string") {
    push(chat, { type: "deck", deckId: result.deckId, title: typeof result.title === "string" ? result.title : "" });
  }
}

/**
 * @param {Chat} chat
 * @param {string} message
 * @param {EditorContext | null} editor
 */
function startTurn(chat, message, editor = null) {
  chat.stopped = false;
  chat.turns += 1;
  // The transcript shows what the user typed; the agent also gets the context.
  push(chat, { type: "user", text: message });
  const prompt = editor
    ? `[Editor] Deck ${editor.deckId} is open on slide ${editor.slideNumber} of ${editor.slideCount} (slide id ${editor.slideId}).\n\n${message}`
    : message;

  const agent = AGENTS[chat.agent];
  const { args, handle } = chat.agent === "codex" ? codexTurn(chat) : claudeTurn(chat);
  console.log(`→ [deck-agent:${chat.agent}] ${message.slice(0, 80).replace(/\s+/g, " ")}`);
  const { cwd, env } = chat.agent === "claude-cli" ? cliWorkspace(chat) : { cwd: WORK_DIR, env: agentEnv() };
  const child = spawn(agent.command, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
  chat.child = child;
  const turn = { done: false, lastError: "" };
  let stderr = "";
  let finished = false;

  const timer = setTimeout(() => {
    push(chat, { type: "error", message: "The AI took longer than 30 minutes, so this turn was stopped." });
    child.kill("SIGTERM");
  }, TURN_TIMEOUT_MS);

  const finish = (error) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (chat.stopped) push(chat, { type: "stopped" });
    else if (error) push(chat, { type: "error", message: error });
    push(chat, { type: "turn-end" });
    chat.child = null;
    endListeners(chat);
  };

  createInterface({ input: child.stdout }).on("line", (line) => {
    const event = parseJson(line);
    if (event) handle(event, turn);
  });

  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("error", (error) => finish(error.code === "ENOENT"
    ? `${agent.name} isn't installed on this computer. ${agent.installHint}`
    : error.message));
  child.on("close", (code) => finish(code !== 0 && !turn.done
    ? `${agent.name} exited with code ${code}: ${(turn.lastError || stderr.trim()).slice(0, 400) || "no output"}`
    : undefined));
  child.stdin.end(prompt);
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

/**
 * Routes under /api/deck-agent. Returns false when the path is not ours.
 * @param {import("node:http").IncomingMessage} request
 * @param {import("node:http").ServerResponse} response
 * @param {(request: import("node:http").IncomingMessage) => Promise<string>} readBody
 */
export async function handleDeckAgentRequest(request, response, readBody) {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const parts = url.pathname.split("/").filter(Boolean); // api, deck-agent, ...
  if (parts[0] !== "api" || parts[1] !== "deck-agent") return false;
  const [, , resource, chatId, action] = parts;

  if (request.method === "GET" && resource === "status" && !chatId) {
    json(response, 200, await status(request.headers.origin));
    return true;
  }

  // Which agents are installed and logged in, and which one is active.
  if (resource === "agents" && !chatId) {
    if (request.method === "GET") {
      json(response, 200, await getAgentState({ refresh: url.searchParams.get("refresh") === "1" }));
      return true;
    }
    if (request.method === "POST") {
      let payload;
      try {
        payload = JSON.parse(await readBody(request));
      } catch {
        json(response, 400, { error: "Request body must be JSON." });
        return true;
      }
      if (payload?.active !== null && !isAgentId(payload?.active)) {
        json(response, 400, { error: "active must be \"claude\", \"codex\" or null." });
        return true;
      }
      try {
        json(response, 200, await setActiveAgent(payload.active));
      } catch (error) {
        if (!(error instanceof AgentError)) throw error;
        json(response, 409, { error: error.message, code: error.code });
      }
      return true;
    }
  }

  if (request.method === "POST" && resource === "chats" && !chatId) {
    let payload;
    try {
      payload = JSON.parse(await readBody(request));
    } catch {
      json(response, 400, { error: "Request body must be JSON." });
      return true;
    }
    const message = typeof payload?.message === "string" ? payload.message.trim() : "";
    if (!message || message.length > MAX_MESSAGE_CHARS) {
      json(response, 400, { error: `Write a message of at most ${MAX_MESSAGE_CHARS} characters.` });
      return true;
    }
    const editor = parseEditorContext(payload.editor);
    if (editor === undefined) {
      json(response, 400, { error: "editor needs deckId, slideId, slideNumber and slideCount." });
      return true;
    }
    const agent = await activeAgent();
    if (!agent) {
      json(response, 409, { error: NO_AGENT_MESSAGE, code: "NO_AGENT" });
      return true;
    }
    // Editor chats revise the open deck through the CLI and its skill.
    if (editor && agent !== "claude-cli") {
      json(response, 409, { error: `The editor's AI chat on any slide needs ${AGENTS["claude-cli"]?.name ?? "Claude Code · CLI"}. Turn it on in the Library's Create with AI panel.`, code: "AGENT_CHANGED" });
      return true;
    }
    let chat;
    if (payload.chatId) {
      chat = chats.get(String(payload.chatId));
      if (!chat) {
        json(response, 404, { error: "This chat ended when the AI bridge restarted. Start a new chat.", code: "CHAT_NOT_FOUND" });
        return true;
      }
      if (isBusy(chat)) {
        json(response, 409, { error: "The AI is still working on your last message.", code: "CHAT_BUSY" });
        return true;
      }
      if (chat.agent !== agent) {
        json(response, 409, { error: `This chat ran on ${AGENTS[chat.agent].name}. A new chat was started for ${AGENTS[agent].name}; send your message again.`, code: "AGENT_CHANGED" });
        return true;
      }
      if (chat.editorDeckId !== (editor?.deckId ?? null)) {
        json(response, 404, { error: "This chat belongs to another deck. Start a new chat.", code: "CHAT_NOT_FOUND" });
        return true;
      }
    } else chat = createChat(agent, editor?.deckId ?? null);
    startTurn(chat, message, editor);
    json(response, 200, { chatId: chat.id, agent: chat.agent });
    return true;
  }

  const chat = chatId ? chats.get(chatId) : undefined;
  if (resource === "chats" && chatId && !chat) {
    json(response, 404, { error: "This chat ended when the AI bridge restarted. Start a new chat.", code: "CHAT_NOT_FOUND" });
    return true;
  }

  // Newline-delimited JSON: every event after `after`, then live events until
  // the current turn ends.
  if (request.method === "GET" && chat && action === "events") {
    const after = Math.max(0, Number(url.searchParams.get("after")) || 0);
    response.writeHead(200, { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" });
    for (const event of chat.events) {
      if (event.seq > after) response.write(`${JSON.stringify(event)}\n`);
    }
    if (!isBusy(chat)) {
      response.end();
      return true;
    }
    chat.listeners.add(response);
    request.on("close", () => chat.listeners.delete(response));
    return true;
  }

  if (request.method === "POST" && chat && action === "stop") {
    if (chat.child) {
      chat.stopped = true;
      chat.child.kill("SIGTERM");
    }
    json(response, 200, { ok: true });
    return true;
  }

  json(response, 404, { error: "Not found." });
  return true;
}
