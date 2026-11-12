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

export async function sendDeckAgentMessage(chatId: string | null, message: string): Promise<string> {
  const response = await request("/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
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
