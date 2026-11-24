"use client";

// Chat state and transcript for the AI agent chats that the bridge runs
// (scripts/deck-agent-chat.mjs): the Library's "Create with AI" panel and the
// editor's "Ask AI" panel.

import { Check, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  DeckAgentError,
  readDeckAgentEvents,
  sendDeckAgentMessage,
  stopDeckAgentTurn,
  type DeckAgentEvent,
  type EditorChatContext,
} from "@/lib/ai/deck-agent-client";

export const TOOL_LABELS: Record<string, [running: string, done: string]> = {
  get_deck_playbook: ["Reading the WKND playbook", "Read the WKND playbook"],
  list_layouts: ["Checking layouts", "Checked layouts"],
  get_brand_styles: ["Checking brand styles", "Checked brand styles"],
  create_deck: ["Creating the deck", "Created the deck"],
  add_slide: ["Adding slides", "Added slides"],
  update_slide: ["Updating slides", "Updated slides"],
  finish_deck: ["Finishing the deck", "Finished the deck"],
  get_deck: ["Reading the deck", "Read the deck"],
  preview_deck: ["Checking the preview", "Checked the preview"],
  start_deck_run: ["Starting an edit run", "Started an edit run"],
  // Claude Code · CLI: the bridge names Bash calls after their wknd-deck command.
  Skill: ["Reading the WKND skill", "Read the WKND skill"],
  Write: ["Writing the deck spec", "Wrote the deck spec"],
  Edit: ["Fixing the deck spec", "Fixed the deck spec"],
  Read: ["Reading the deck spec", "Read the deck spec"],
  "wknd-deck guide": ["Reading the WKND playbook", "Read the WKND playbook"],
  "wknd-deck layouts": ["Checking layouts", "Checked layouts"],
  "wknd-deck layouts show": ["Checking layouts", "Checked layouts"],
  "wknd-deck layouts usage": ["Checking recent layouts", "Checked recent layouts"],
  "wknd-deck brand": ["Checking brand styles", "Checked brand styles"],
  "wknd-deck check": ["Checking the copy", "Checked the copy"],
  "wknd-deck deck create": ["Building the deck", "Built the deck"],
  "wknd-deck deck show": ["Reading the deck", "Read the deck"],
  "wknd-deck deck set": ["Updating the deck", "Updated the deck"],
  "wknd-deck deck finish": ["Finishing the deck", "Finished the deck"],
  "wknd-deck slide add": ["Adding slides", "Added slides"],
  "wknd-deck slide update": ["Updating slides", "Updated slides"],
  "wknd-deck slide move": ["Moving slides", "Moved slides"],
  "wknd-deck slide duplicate": ["Duplicating slides", "Duplicated slides"],
  "wknd-deck slide delete": ["Deleting slides", "Deleted slides"],
  "wknd-deck slide show": ["Reading a slide", "Read a slide"],
};

function readSavedChat(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveChat(key: string, chatId: string | null) {
  try {
    if (chatId) sessionStorage.setItem(key, chatId);
    else sessionStorage.removeItem(key);
  } catch {
    // The chat still works in this tab; it just won't survive a reload.
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The bridge keeps the transcript; the tab only remembers which chat it is in,
// under `storageKey`.
export function useDeckAgentChat(storageKey: string) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [events, setEvents] = useState<DeckAgentEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const lastSeq = useRef(0);
  const busyRef = useRef(false);
  const streamRef = useRef<AbortController | null>(null);

  const reset = useCallback((message = "") => {
    streamRef.current?.abort();
    streamRef.current = null;
    lastSeq.current = 0;
    busyRef.current = false;
    saveChat(storageKey, null);
    setChatId(null);
    setEvents([]);
    setBusy(false);
    setError(message);
  }, [storageKey]);

  const addEvent = useCallback((event: DeckAgentEvent) => {
    if (event.seq <= lastSeq.current) return;
    lastSeq.current = event.seq;
    if (event.type === "user") busyRef.current = true;
    if (event.type === "turn-end") busyRef.current = false;
    setBusy(busyRef.current);
    setEvents((current) => [...current, event]);
  }, []);

  // Follows the chat until the current turn ends, reconnecting if the stream
  // drops while the AI is still working.
  const follow = useCallback(async (id: string) => {
    streamRef.current?.abort();
    const controller = new AbortController();
    streamRef.current = controller;
    let failures = 0;
    while (!controller.signal.aborted) {
      try {
        await readDeckAgentEvents(id, lastSeq.current, addEvent, controller.signal);
        failures = 0;
        if (!busyRef.current) return;
      } catch (caught) {
        if (controller.signal.aborted) return;
        if (caught instanceof DeckAgentError && caught.code === "CHAT_NOT_FOUND") {
          reset(caught.message);
          return;
        }
        if (++failures > 4) {
          setBusy(false);
          setError(caught instanceof Error ? caught.message : "Lost the connection to the AI bridge.");
          return;
        }
      }
      await wait(1000 * Math.max(1, failures));
    }
  }, [addEvent, reset]);

  useEffect(() => {
    const saved = readSavedChat(storageKey);
    if (saved) {
      // Restoring a chat kept by the bridge, e.g. after visiting the editor.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChatId(saved);
      void follow(saved);
    }
    return () => streamRef.current?.abort();
  }, [follow, storageKey]);

  const send = useCallback(async (text: string, editor?: EditorChatContext) => {
    const message = text.trim();
    if (!message || busyRef.current) return false;
    setSending(true);
    setError("");
    try {
      const id = await sendDeckAgentMessage(chatId, message, editor);
      if (id !== chatId) {
        saveChat(storageKey, id);
        setChatId(id);
      }
      busyRef.current = true;
      setBusy(true);
      void follow(id);
      return true;
    } catch (caught) {
      if (caught instanceof DeckAgentError && (caught.code === "CHAT_NOT_FOUND" || caught.code === "AGENT_CHANGED")) reset(caught.message);
      else setError(caught instanceof Error ? caught.message : "The message could not be sent.");
      return false;
    } finally {
      setSending(false);
    }
  }, [chatId, follow, reset, storageKey]);

  const stop = useCallback(async () => {
    if (!chatId) return;
    try {
      await stopDeckAgentTurn(chatId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The AI could not be stopped.");
    }
  }, [chatId]);

  return { chatId, events, busy, sending, error, setError, send, stop, reset };
}

export type ToolLine = { name: string; count: number; running: number; failed: number };
export type TranscriptItem =
  | { kind: "user" | "assistant" | "error" | "notice"; key: string; text: string }
  | { kind: "tools"; key: string; lines: ToolLine[] }
  | { kind: "deck"; key: string; deckId: string; title: string };

// Turns the event log into chat bubbles, with consecutive tool calls folded
// into one activity group.
export function toTranscript(events: readonly DeckAgentEvent[]): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  const toolNames = new Map<string, string>();
  const decks = new Set<string>();
  const currentTools = () => {
    const last = items.at(-1);
    return last?.kind === "tools" ? last : null;
  };
  for (const event of events) {
    const key = String(event.seq);
    if (event.type === "user" || event.type === "assistant") items.push({ kind: event.type, key, text: event.text });
    else if (event.type === "error") items.push({ kind: "error", key, text: event.message });
    else if (event.type === "stopped") items.push({ kind: "notice", key, text: "Stopped." });
    else if (event.type === "deck") {
      if (decks.has(event.deckId)) continue;
      decks.add(event.deckId);
      items.push({ kind: "deck", key, deckId: event.deckId, title: event.title });
    } else if (event.type === "tool") {
      toolNames.set(event.id, event.name);
      let group = currentTools();
      if (!group) {
        group = { kind: "tools", key, lines: [] };
        items.push(group);
      }
      let line = group.lines.find((item) => item.name === event.name);
      if (!line) {
        line = { name: event.name, count: 0, running: 0, failed: 0 };
        group.lines.push(line);
      }
      line.count += 1;
      line.running += 1;
    } else if (event.type === "tool-result") {
      const name = toolNames.get(event.id) ?? event.name;
      for (let index = items.length - 1; index >= 0; index--) {
        const item = items[index];
        const line = item.kind === "tools" ? item.lines.find((entry) => entry.name === name && entry.running > 0) : undefined;
        if (line) {
          line.running -= 1;
          if (!event.ok) line.failed += 1;
          break;
        }
      }
    } else if (event.type === "turn-end") {
      // A stopped or failed turn leaves calls without a result.
      for (const item of items) if (item.kind === "tools") for (const line of item.lines) line.running = 0;
    }
  }
  return items;
}

// Links from deck tools carry the service token in their fragment.
const withoutTokens = (text: string) => text.replace(/#service=[^\s)\]>]*/g, "");

export function FormattedText({ text }: { text: string }) {
  const parts = withoutTokens(text).split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={index} className="rounded bg-surface-01/70 px-1 text-[12px]">{part.slice(1, -1)}</code>;
        return part;
      })}
    </>
  );
}

// One activity group: what the agent is doing or did, per tool.
export function ToolLines({ lines }: { lines: readonly ToolLine[] }) {
  return (
    <ul className="flex flex-col gap-1 self-start px-1">
      {lines.map((line) => {
        const [running, done] = TOOL_LABELS[line.name] ?? [line.name, line.name];
        return (
          <li key={line.name} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            {line.running > 0 ? (
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Check aria-hidden="true" className="size-3.5" strokeWidth={2} />
            )}
            <span>{line.running > 0 ? `${running}…` : done}</span>
            {line.count > 1 ? <span className="tabular-nums">· {line.count}</span> : null}
            {line.failed > 0 ? <span className="text-[#B3361A]">· {line.failed} failed</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
