// "Create with AI" chats for the Library home, served by scripts/ai-bridge.mjs.
//
// Every user message runs one headless Claude Code turn (`claude -p`) that may
// only call the deck_builder MCP tools, so it follows the same playbook as the
// CLI agent and builds the deck live through the local deck service. Turns run
// independently of the browser request: the transcript is kept here, so the
// user can open the deck in the editor while it builds and come back to the
// chat later. Chats live in memory and end when the bridge restarts.

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { deckMcpServer } from "./deck-mcp-config.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = resolve(process.env.DECK_DATA_DIR ?? join(ROOT, ".deck-builder"));
// A turn that builds a whole deck can take a while.
const TURN_TIMEOUT_MS = 30 * 60_000;
const MAX_CHATS = 20;
const MAX_MESSAGE_CHARS = 20_000;
// Claude runs outside the project and without built-in tools, so it can only
// reach the deck through deck_builder. One folder keeps `--resume` working.
const WORK_DIR = mkdtempSync(join(tmpdir(), "deck-agent-"));

const SYSTEM_PROMPT = `You are the WKND deck agent inside the "Create with AI" chat of the Deck Library, in the user's browser.
- Plan, write and build presentations only with the deck_builder tools. Call get_deck_playbook before planning a new deck and follow it: brief, one storyline approval, then write the copy and build live without asking again.
- You have no file, shell or web access. If the user shares a document, they have to paste its text into the chat.
- The new deck appears in the Library as soon as the cover is saved, and the chat shows an "Open deck" button for it. Never paste Library, editor or preview links, and never print tokens; just say the deck is ready in the Library.
- Write in the user's language. Keep replies short: plain text with simple numbered or bulleted lists, no tables or headings.`;

/** @type {Map<string, Chat>} */
const chats = new Map();

/**
 * @typedef {{ id: string, sessionId: string | null, events: object[], listeners: Set<import("node:http").ServerResponse>, child: import("node:child_process").ChildProcess | null, stopped: boolean, updatedAt: number }} Chat
 */

export function claudeEnv() {
  // Allow starting the bridge from a terminal inside Claude Code.
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  return env;
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

function createChat() {
  if (chats.size >= MAX_CHATS) {
    const idle = [...chats.values()].filter((chat) => !isBusy(chat)).sort((a, b) => a.updatedAt - b.updatedAt);
    if (idle[0]) {
      endListeners(idle[0]);
      chats.delete(idle[0].id);
    }
  }
  const chat = { id: randomUUID(), sessionId: null, events: [], listeners: new Set(), child: null, stopped: false, updatedAt: Date.now() };
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

function startTurn(chat, message) {
  chat.stopped = false;
  push(chat, { type: "user", text: message });

  const args = [
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

  console.log(`→ [deck-agent] ${message.slice(0, 80).replace(/\s+/g, " ")}`);
  const child = spawn("claude", args, { cwd: WORK_DIR, env: claudeEnv(), stdio: ["pipe", "pipe", "pipe"] });
  chat.child = child;
  const toolNames = new Map();
  let stderr = "";
  let finished = false;
  let gotResult = false;

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
    if (!event) return;
    if (event.type === "system" && event.subtype === "init" && event.session_id) {
      chat.sessionId = event.session_id;
    } else if (event.type === "assistant") {
      for (const part of event.message?.content ?? []) {
        if (part.type === "text" && part.text?.trim()) push(chat, { type: "assistant", text: part.text });
        else if (part.type === "tool_use") {
          const name = shortToolName(part.name);
          toolNames.set(part.id, name);
          push(chat, { type: "tool", id: part.id, name });
        }
      }
    } else if (event.type === "user") {
      for (const part of event.message?.content ?? []) {
        if (part.type !== "tool_result") continue;
        const result = parseJson(toolResultText(part.content));
        const ok = !part.is_error && result?.ok !== false;
        push(chat, { type: "tool-result", id: part.tool_use_id, name: toolNames.get(part.tool_use_id) ?? "", ok });
        if (ok && typeof result?.deckId === "string") {
          push(chat, { type: "deck", deckId: result.deckId, title: typeof result.title === "string" ? result.title : "" });
        }
      }
    } else if (event.type === "result") {
      gotResult = true;
      if (event.session_id) chat.sessionId = event.session_id;
      if (event.is_error && !chat.stopped) push(chat, { type: "error", message: String(event.result || "Claude returned an error.") });
    }
  });

  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("error", (error) => finish(error.code === "ENOENT"
    ? "`claude` command not found. Install Claude Code and log in first."
    : error.message));
  child.on("close", (code) => finish(code !== 0 && !gotResult
    ? `Claude exited with code ${code}: ${stderr.trim().slice(0, 400) || "no output"}`
    : undefined));
  child.stdin.end(message);
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
    } else chat = createChat();
    startTurn(chat, message);
    json(response, 200, { chatId: chat.id });
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
