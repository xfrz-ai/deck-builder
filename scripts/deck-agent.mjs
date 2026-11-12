#!/usr/bin/env node
// Start a project-scoped Codex or Claude Code session without changing the user's global config.
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { deckMcpServer } from "./deck-mcp-config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(process.env.DECK_DATA_DIR ?? resolve(root, ".deck-builder"));
// Pair the Library in a browser once. The credential stays in the URL fragment
// until browser code moves it to sessionStorage; it is never printed to stdout.
async function openLibrary() {
  if (process.env.DECK_AGENT_OPEN_LIBRARY === "0" || process.argv.slice(2).some(arg => ["--help", "-h", "--version", "-V"].includes(arg))) return;
  try {
    const connection = JSON.parse(await readFile(resolve(dataDir, "connection.json"), "utf8"));
    for (const value of [connection.url, connection.appUrl]) {
      const url = new URL(value);
      if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid local origin");
    }
    const health = await fetch(`${connection.url}/health`, { headers: { Authorization: `Bearer ${connection.token}` }, signal: AbortSignal.timeout(1500), redirect: "error" });
    if (!health.ok) throw new Error("Service unavailable");
    const url = new URL(connection.appUrl);
    url.hash = new URLSearchParams({ service: connection.url, token: connection.token }).toString();
    const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "rundll32" : "xdg-open";
    const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url.href] : [url.href];
    const browser = spawn(command, args, { stdio: "ignore", detached: true });
    browser.on("error", () => console.error("Open the Library link returned by create_deck to connect your browser."));
    browser.unref();
  } catch { console.error("Start npm run deck-service first. You can also connect using the Library link returned by create_deck."); }
}
// First argument picks the agent: `codex` (default) or `claude`. Remaining
// arguments are passed to that CLI unchanged.
const [first, ...rest] = process.argv.slice(2);
const agent = first === "claude" || first === "codex" ? first : "codex";
const passThrough = first === agent ? rest : process.argv.slice(2);

const CLAUDE_SYSTEM_PROMPT = "You are the WKND deck agent in this session. Plan, write and build presentations with the deck_builder MCP tools: call get_deck_playbook before planning a new deck and follow it. Do not edit the application source code unless the user explicitly asks for code changes.";

void openLibrary();
const [command, args] = agent === "claude"
  ? ["claude", [
    "--mcp-config", JSON.stringify({ mcpServers: { deck_builder: deckMcpServer(root, dataDir) } }),
    "--allowedTools", "mcp__deck_builder",
    // Single-value option last: the two options above are variadic.
    "--append-system-prompt", CLAUDE_SYSTEM_PROMPT,
    ...passThrough,
  ]]
  : ["codex", [
    "-C", root,
    "-c", `mcp_servers.deck_builder.command=${JSON.stringify(process.execPath)}`,
    "-c", `mcp_servers.deck_builder.args=${JSON.stringify(["--import", "tsx", resolve(root, "scripts/deck-mcp.ts")])}`,
    "-c", `mcp_servers.deck_builder.cwd=${JSON.stringify(root)}`,
    "-c", `mcp_servers.deck_builder.env.DECK_DATA_DIR=${JSON.stringify(dataDir)}`,
    "-c", "mcp_servers.deck_builder.required=true",
    ...passThrough,
  ]];
const child = spawn(command, args, { cwd: root, stdio: "inherit" });
child.on("error", () => { console.error(`Could not start ${agent === "claude" ? "Claude Code" : "Codex"} CLI. Install it and log in first.`); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
