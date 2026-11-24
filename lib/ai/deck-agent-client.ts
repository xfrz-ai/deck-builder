// Browser side of the "Create with AI" chat. The AI bridge
// (scripts/deck-agent-chat.mjs) runs each turn and keeps the transcript, so the
// page only sends messages and reads the event stream.
import { AI_BRIDGE_URL } from "@/lib/ai/bridge-client";

export type DeckAgentEvent = { seq: number } & (
  | { type: "user"; text: string }
  | { type: "assistant"; text: string }
  | { type: "tool"; id: string; name: string }
  | { type: "tool-result"; id: string; name: string; ok: boolean }
  | { type: "deck"; deckId: string; title: string }
  | { type: "error"; message: string }
  | { type: "stopped" }
  | { type: "turn-end" }
);

export interface DeckAgentStatus {
  deckService: boolean;
  // Only returned to the Library origin, so the home page can list the deck.
  connection: { url: string; token: string } | null;
}

// "claude-cli" is Claude Code working through the wknd-deck CLI and skill; the
// bridge offers it only in a checkout of the project.
export type AgentId = "claude" | "claude-cli" | "codex";

export interface AgentInfo {
  id: AgentId;
  name: string;
  installed: boolean;
  version: string | null;
  // null when the CLI can't tell.
  loggedIn: boolean | null;
  // What to do before this agent can be used, if anything.
  hint: string | null;
}

export interface AgentState {
  // The agent new chats and the editor's AI features use; null when AI is off.
  active: AgentId | null;
  agents: AgentInfo[];
}

export const isAgentReady = (agent: AgentInfo | undefined) => Boolean(agent?.installed && agent.loggedIn !== false);

export class DeckAgentError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

const BRIDGE_DOWN = "The AI bridge isn't running. Start it with `npm run ai-bridge` in a separate terminal.";

async function request(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`${AI_BRIDGE_URL}/api/deck-agent${path}`, init);
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new DeckAgentError(BRIDGE_DOWN, "BRIDGE_DOWN");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: unknown; code?: unknown } | null;
    const code = typeof body?.code === "string" ? body.code : undefined;
    if (response.status === 404 && !code) {
      throw new DeckAgentError("The AI bridge is out of date. Restart it with `npm run ai-bridge`.", "BRIDGE_OUTDATED");
    }
    throw new DeckAgentError(typeof body?.error === "string" ? body.error : `AI bridge error (${response.status}).`, code);
  }
  return response;
}

export async function getDeckAgentStatus(signal?: AbortSignal): Promise<DeckAgentStatus> {
  const body = await (await request("/status", { signal })).json();
  return {
    deckService: body?.deckService === true,
    connection: typeof body?.connection?.url === "string" && typeof body?.connection?.token === "string" ? body.connection : null,
  };
}

const isAgentId = (value: unknown): value is AgentId => value === "claude" || value === "claude-cli" || value === "codex";

function parseAgentState(body: unknown): AgentState {
  const value = body as { active?: unknown; agents?: unknown } | null;
  const agents = (Array.isArray(value?.agents) ? value.agents : []).flatMap((item): AgentInfo[] => {
    if (!isAgentId(item?.id)) return [];
    return [{
      id: item.id,
      name: typeof item.name === "string" ? item.name : item.id,
      installed: item.installed === true,
      version: typeof item.version === "string" ? item.version : null,
      loggedIn: typeof item.loggedIn === "boolean" ? item.loggedIn : null,
      hint: typeof item.hint === "string" ? item.hint : null,
    }];
  });
  return { active: isAgentId(value?.active) ? value.active : null, agents };
}

// `refresh` checks the CLIs again instead of using the last result.
export async function getAgentState(refresh = false, signal?: AbortSignal): Promise<AgentState> {
  return parseAgentState(await (await request(`/agents${refresh ? "?refresh=1" : ""}`, { signal })).json());
}

// Turns one agent on (and the other off), or AI off with null.
export async function setActiveAgent(active: AgentId | null): Promise<AgentState> {
  const response = await request("/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active }),
  });
  return parseAgentState(await response.json());
}

// Sent by the editor's AI chat with every message: the open deck and the slide
// on screen. The bridge then runs the turn as a revision of that deck.
export interface EditorChatContext {
  deckId: string;
  slideId: string;
  slideNumber: number;
  slideCount: number;
}

export async function sendDeckAgentMessage(chatId: string | null, message: string, editor?: EditorChatContext): Promise<string> {
  const response = await request("/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message, ...(editor ? { editor } : {}) }),
  });
  const body = await response.json();
  if (typeof body?.chatId !== "string") throw new DeckAgentError("The AI bridge did not start the chat.");
  return body.chatId;
}

export async function stopDeckAgentTurn(chatId: string) {
  await request(`/chats/${encodeURIComponent(chatId)}/stop`, { method: "POST" });
}

// Reads every event after `after` and then live events until the current
// turn ends. Resolves when the bridge closes the stream.
export async function readDeckAgentEvents(
  chatId: string,
  after: number,
  onEvent: (event: DeckAgentEvent) => void,
  signal: AbortSignal,
) {
  const response = await request(`/chats/${encodeURIComponent(chatId)}/events?after=${after}`, { signal });
  if (!response.body) return;
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line) as DeckAgentEvent);
        } catch {
          // Ignore a malformed line; the next one is independent.
        }
      }
      newline = buffer.indexOf("\n");
    }
  }
}
