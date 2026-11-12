import type { DeckSnapshot } from "@/lib/deck-service/deck-document";
import type { Presentation } from "@/types/presentation";

export interface BrowserConnection { url: string; token: string }
export const CONNECTION_EVENT = "deck-service-connection";
let bridge: BroadcastChannel | undefined;
function shareConnection() {
  if (bridge || typeof BroadcastChannel === "undefined") return;
  bridge = new BroadcastChannel("deck-service-connection");
  bridge.onmessage = event => {
    try {
      if (event.data?.type === "request") {
        const saved = sessionStorage.getItem("deck-service-connection");
        if (saved) bridge?.postMessage({ type: "connection", connection: JSON.parse(saved) });
      } else if (event.data?.type === "connection") {
        const connection = { url: localOrigin(event.data.connection.url), token: String(event.data.connection.token) };
        if (!connection.token || connection.token.length > 512) return;
        const serialized = JSON.stringify(connection);
        if (sessionStorage.getItem("deck-service-connection") !== serialized) {
          sessionStorage.setItem("deck-service-connection", serialized);
          window.dispatchEvent(new Event(CONNECTION_EVENT));
        }
      }
    } catch { /* An invalid message cannot change the current connection. */ }
  };
  bridge.postMessage({ type: "request" });
}
export class LocalDeckClientError extends Error {
  constructor(message: string, public code?: string, public currentRevision?: number) { super(message); }
}
function localOrigin(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Use a local http://127.0.0.1:port service address.");
  }
  return url.origin;
}
export function readBrowserConnection(): BrowserConnection | null {
  shareConnection();
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if (fragment.has("token")) {
    const connection = { url: localOrigin(fragment.get("service") ?? "http://127.0.0.1:8790"), token: fragment.get("token")! };
    history.replaceState(null, "", window.location.pathname + window.location.search);
    rememberConnection(connection.url, connection.token);
    return connection;
  }
  const saved = sessionStorage.getItem("deck-service-connection");
  if (!saved) return null;
  const connection = JSON.parse(saved);
  return { url: localOrigin(connection.url), token: String(connection.token) };
}
export function rememberConnection(url: string, token: string): BrowserConnection {
  const connection = { url: localOrigin(url), token: token.trim() };
  sessionStorage.setItem("deck-service-connection", JSON.stringify(connection));
  shareConnection();
  bridge?.postMessage({ type: "connection", connection });
  queueMicrotask(() => window.dispatchEvent(new Event(CONNECTION_EVENT)));
  return connection;
}
export async function localRequest(connection: BrowserConnection, path: string, method = "GET", payload?: unknown) {
  let response: Response;
  try {
    response = await fetch(`${connection.url}${path}`, {
      method, headers: { Authorization: `Bearer ${connection.token}`, ...(payload === undefined ? {} : { "Content-Type": "application/json" }) },
      body: payload === undefined ? undefined : JSON.stringify(payload), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000),
    });
  } catch { throw new LocalDeckClientError("Cannot reach the local deck service. Start npm run deck-service, then retry."); }
  const result = await response.json();
  if (!response.ok) throw new LocalDeckClientError(result.error?.message ?? "Local deck request failed.", result.error?.code, result.error?.currentRevision);
  return result;
}
export async function loadLocalDeck(connection: BrowserConnection, deckId: string): Promise<DeckSnapshot> {
  const result = await localRequest(connection, `/decks/${encodeURIComponent(deckId)}`);
  return result.document;
}
export async function saveLocalDeck(connection: BrowserConnection, deckId: string, expectedRevision: number, presentation: Presentation, requestId: string): Promise<DeckSnapshot> {
  const result = await localRequest(connection, `/decks/${encodeURIComponent(deckId)}`, "PUT", { deckId, expectedRevision, requestId, presentation });
  return result.document;
}
export async function deleteLocalDeck(connection: BrowserConnection, deckId: string, expectedRevision: number) {
  return localRequest(connection, `/decks/${encodeURIComponent(deckId)}`, "DELETE", { deckId, expectedRevision });
}
export function downloadDraft(presentation: Presentation) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(presentation, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `${presentation.id}-draft.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
