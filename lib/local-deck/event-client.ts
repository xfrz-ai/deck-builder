import { deckEventSchema, type DeckEvent } from "@/lib/deck-service/event-types";
import type { BrowserConnection } from "./client";

export type LiveConnectionStatus = "connecting" | "connected" | "reconnecting" | "unauthorized" | "deleted";

// Incremental SSE framing: handles CRLF and UTF-8 chunk boundaries, comments,
// multiline data, and multiple events arriving in one network read.
export class SseParser {
  private buffer = "";
  private data: string[] = [];
  private id = "";
  private event = "message";
  constructor(private onFrame: (frame: { id: string; event: string; data: string }) => void) {}
  push(text: string) {
    this.buffer += text;
    if (this.buffer.length > 128 * 1024) throw new Error("Event frame exceeds the metadata limit.");
    while (true) {
      const index = this.buffer.search(/[\r\n]/);
      if (index < 0 || (this.buffer[index] === "\r" && index === this.buffer.length - 1)) break;
      const length = this.buffer[index] === "\r" && this.buffer[index + 1] === "\n" ? 2 : 1;
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + length);
      if (!line) {
        if (this.data.length) this.onFrame({ id: this.id, event: this.event, data: this.data.join("\n") });
        this.data = []; this.id = ""; this.event = "message";
      } else if (!line.startsWith(":")) {
        const colon = line.indexOf(":");
        const key = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
        if (key === "data") this.data.push(value);
        if (key === "id") this.id = value;
        if (key === "event") this.event = value;
        if (this.data.reduce((size, part) => size + part.length, 0) > 128 * 1024) throw new Error("Event frame exceeds the metadata limit.");
      }
    }
  }
}

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>(resolve => {
    const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
    if (signal.aborted) done();
  });
}

export async function watchDeckEvents(connection: BrowserConnection, deckId: string, callbacks: {
  event: (event: DeckEvent) => void;
  status: (status: LiveConnectionStatus) => void;
}, signal: AbortSignal, library = false) {
  let cursor: string | undefined;
  let instance: string | undefined;
  let sequence = -1;
  let backoff = 500;
  let first = true;
  while (!signal.aborted) {
    callbacks.status(first ? "connecting" : "reconnecting"); first = false;
    const attempt = new AbortController();
    const abort = () => attempt.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    let idle: ReturnType<typeof setTimeout> | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const resetIdle = () => { clearTimeout(idle); idle = setTimeout(abort, 45_000); };
    try {
      resetIdle();
      const response = await fetch(`${connection.url}${library ? "/events" : `/decks/${encodeURIComponent(deckId)}/events`}`, {
        headers: { Authorization: `Bearer ${connection.token}`, ...(cursor ? { "Last-Event-ID": cursor } : {}) },
        signal: attempt.signal, cache: "no-store", redirect: "error",
      });
      if (response.status === 401 || response.status === 403) { callbacks.status("unauthorized"); return; }
      if (!library && response.status === 410) { callbacks.status("deleted"); return; }
      if (!response.ok || !response.body || !response.headers.get("content-type")?.startsWith("text/event-stream")) throw new Error("Event connection unavailable.");
      callbacks.status("connected"); backoff = 500;
      const parser = new SseParser(frame => {
        const event = deckEventSchema.parse(JSON.parse(frame.data));
        if ((!library && event.deckId !== deckId) || event.id !== frame.id || event.type !== frame.event || event.id !== `${event.instance}:${event.sequence}`) throw new Error("Invalid deck event.");
        if (event.type === "connection.sync") {
          if (instance !== event.instance || event.reset) { instance = event.instance; sequence = event.sequence; cursor = event.id; }
          callbacks.event(event); return;
        }
        if (instance !== event.instance || event.sequence <= sequence) return;
        sequence = event.sequence; cursor = event.id; callbacks.event(event);
      });
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (!attempt.signal.aborted) {
        const chunk = await reader.read();
        if (chunk.done) break;
        resetIdle(); parser.push(decoder.decode(chunk.value, { stream: true }));
      }
    } catch { /* Retain the editor draft and resync after reconnect. */ }
    finally {
      clearTimeout(idle); signal.removeEventListener("abort", abort);
      await reader?.cancel().catch(() => undefined);
      attempt.abort();
    }
    if (!signal.aborted) { callbacks.status("reconnecting"); await pause(backoff, signal); backoff = Math.min(backoff * 2, 10_000); }
  }
}

export const watchLibraryEvents = (connection: BrowserConnection, callbacks: Parameters<typeof watchDeckEvents>[2], signal: AbortSignal) => watchDeckEvents(connection, "*", callbacks, signal, true);
