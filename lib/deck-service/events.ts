import { randomUUID } from "node:crypto";
import type { DeckEvent, EventInput } from "./event-types";

// Metadata only: no prompts, bearer tokens, document snapshots or inline images.
export class DeckEvents {
  readonly instance = randomUUID();
  private sequence = 0;
  private buffer: DeckEvent[] = [];
  private listeners = new Map<string, Set<(event: DeckEvent) => void>>();
  constructor(private capacity = 256) {}

  publish(input: EventInput) {
    const event: DeckEvent = { ...input, instance: this.instance, sequence: ++this.sequence, id: `${this.instance}:${this.sequence}` };
    this.buffer.push(event);
    if (this.buffer.length > this.capacity) this.buffer.shift();
    for (const channel of [event.deckId, "*"]) for (const listener of this.listeners.get(channel) ?? []) {
      try { listener(event); } catch { this.listeners.get(channel)?.delete(listener); }
    }
    return event;
  }

  subscribe(deckId: string, cursor: string | undefined, listener: (event: DeckEvent) => void) {
    const last = cursor?.split(":");
    const sequence = Number(last?.[1]);
    const valid = last?.[0] === this.instance && Number.isSafeInteger(sequence) && sequence >= 0 && sequence <= this.sequence && sequence >= (this.buffer[0]?.sequence ?? this.sequence) - 1;
    const listeners = this.listeners.get(deckId) ?? new Set();
    listeners.add(listener); this.listeners.set(deckId, listeners);
    // Subscribe and capture the replay window synchronously: no registration gap.
    return {
      reset: !valid,
      replay: valid ? this.buffer.filter(event => (deckId === "*" || event.deckId === deckId) && event.sequence > sequence) : [],
      close: () => { listeners.delete(listener); if (!listeners.size) this.listeners.delete(deckId); },
    };
  }

  sync(deckId: string, revision: number, reset: boolean): DeckEvent {
    return { type: "connection.sync", id: `${this.instance}:${this.sequence}`, instance: this.instance, sequence: this.sequence, deckId, revision, source: "service", changedSlideIds: [], reset };
  }
}
