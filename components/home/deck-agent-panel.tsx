"use client";

import {
  AlertTriangle,
  ArrowUp,
  Check,
  LoaderCircle,
  Presentation as PresentationIcon,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DeckAgentError,
  getDeckAgentStatus,
  readDeckAgentEvents,
  sendDeckAgentMessage,
  stopDeckAgentTurn,
  type DeckAgentEvent,
  type DeckAgentStatus,
} from "@/lib/ai/deck-agent-client";
import { rememberConnection } from "@/lib/local-deck/client";
import { cn } from "@/lib/utils";

// The bridge keeps the transcript; the tab only remembers which chat it is in.
const CHAT_KEY = "deck-agent-chat";

const EXAMPLES = [
  "Pitch redesign aplikasi mobile untuk [Nama Klien], sekitar 10 slide",
  "Proposal kampanye social media 3 bulan untuk brand F&B",
  "Company profile WKND untuk calon klien baru",
];

const TOOL_LABELS: Record<string, [running: string, done: string]> = {
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
};

function readSavedChat() {
  try {
    return sessionStorage.getItem(CHAT_KEY);
  } catch {
    return null;
  }
}

function saveChat(chatId: string | null) {
  try {
    if (chatId) sessionStorage.setItem(CHAT_KEY, chatId);
    else sessionStorage.removeItem(CHAT_KEY);
  } catch {
    // The chat still works in this tab; it just won't survive a reload.
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function useDeckAgentChat() {
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
    saveChat(null);
    setChatId(null);
    setEvents([]);
    setBusy(false);
    setError(message);
  }, []);

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
    const saved = readSavedChat();
    if (saved) {
      // Restoring a chat kept by the bridge, e.g. after visiting the editor.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChatId(saved);
      void follow(saved);
    }
    return () => streamRef.current?.abort();
  }, [follow]);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || busyRef.current) return false;
    setSending(true);
    setError("");
    try {
      const id = await sendDeckAgentMessage(chatId, message);
      if (id !== chatId) {
        saveChat(id);
        setChatId(id);
      }
      busyRef.current = true;
      setBusy(true);
      void follow(id);
      return true;
    } catch (caught) {
      if (caught instanceof DeckAgentError && caught.code === "CHAT_NOT_FOUND") reset(caught.message);
      else setError(caught instanceof Error ? caught.message : "The message could not be sent.");
      return false;
    } finally {
      setSending(false);
    }
  }, [chatId, follow, reset]);

  const stop = useCallback(async () => {
    if (!chatId) return;
    try {
      await stopDeckAgentTurn(chatId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The AI could not be stopped.");
    }
  }, [chatId]);

  return { chatId, events, busy, sending, error, send, stop, reset };
}

type ToolLine = { name: string; count: number; running: number; failed: number };
type TranscriptItem =
  | { kind: "user" | "assistant" | "error" | "notice"; key: string; text: string }
  | { kind: "tools"; key: string; lines: ToolLine[] }
  | { kind: "deck"; key: string; deckId: string; title: string };

// Turns the event log into chat bubbles, with consecutive tool calls folded
// into one activity group.
function toTranscript(events: readonly DeckAgentEvent[]): TranscriptItem[] {
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

function FormattedText({ text }: { text: string }) {
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

function SetupNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl bg-[#E04E2B]/10 p-3 text-[12px] leading-5 text-[#B3361A]" role="alert">
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function DeckAgentPanel({
  open,
  onClose,
  serviceConnected,
  onOpenDeck,
}: {
  open: boolean;
  onClose: () => void;
  serviceConnected: boolean;
  onOpenDeck: (deckId: string) => void;
}) {
  const chat = useDeckAgentChat();
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<DeckAgentStatus | null>(null);
  const [bridgeDown, setBridgeDown] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const transcript = useMemo(() => toTranscript(chat.events), [chat.events]);

  // Checks the bridge and deck service, and connects the Library to the deck
  // service so the new deck shows up on the home page.
  const checkStatus = useCallback((signal?: AbortSignal) => getDeckAgentStatus(signal).then(
    (next) => {
      setStatus(next);
      setBridgeDown(false);
      if (next.connection && !serviceConnected) rememberConnection(next.connection.url, next.connection.token);
    },
    () => {
      if (signal?.aborted) return;
      setStatus(null);
      setBridgeDown(true);
    },
  ), [serviceConnected]);

  // Re-checked when the panel opens and after every turn.
  useEffect(() => {
    const controller = new AbortController();
    void checkStatus(controller.signal);
    return () => controller.abort();
  }, [checkStatus, open, chat.busy]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript, chat.busy, open]);

  const submit = async (text: string) => {
    if (await chat.send(text)) setInput("");
  };

  const canSend = !chat.busy && !chat.sending && !bridgeDown;

  return (
    <section
      aria-label="Create with AI"
      className={cn(
        "fixed bottom-3 right-3 top-3 z-30 w-[400px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[1.25rem] border border-stroke-01 bg-surface-01 shadow-popover",
        open ? "flex" : "hidden",
      )}
    >
      <header className="flex items-center gap-2 border-b border-stroke-01 p-3 pl-4">
        <div aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
          <Sparkles className="size-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-primary">Create with AI</h2>
          <p className="truncate text-[12px] text-muted-foreground">
            {chat.busy ? "Working…" : "Brief, storyline, then a live build"}
          </p>
        </div>
        {chat.chatId ? (
          <Button
            aria-label="Start a new chat"
            disabled={chat.busy}
            size="icon-sm"
            title="New chat"
            variant="ghost"
            onClick={() => {
              chat.reset();
              setInput("");
              inputRef.current?.focus();
            }}
          >
            <RotateCcw className="size-4" />
          </Button>
        ) : null}
        <Button aria-label="Close" size="icon-sm" variant="ghost" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </header>

      <div ref={listRef} className="editor-scrollbar flex flex-1 flex-col gap-2.5 overflow-y-auto p-3" aria-live="polite">
        {bridgeDown ? (
          <SetupNotice>
            The AI bridge isn&apos;t running. Start <code className="font-semibold">npm run ai-bridge</code> in a separate terminal.
            <button className="ml-1 cursor-pointer underline underline-offset-2" type="button" onClick={() => void checkStatus()}>Check again</button>
          </SetupNotice>
        ) : status && !status.deckService ? (
          <SetupNotice>
            The deck service isn&apos;t running, so the AI can plan but not build. Start <code className="font-semibold">npm run deck-service</code>.
            <button className="ml-1 cursor-pointer underline underline-offset-2" type="button" onClick={() => void checkStatus()}>Check again</button>
          </SetupNotice>
        ) : null}

        {transcript.length === 0 ? (
          <div className="flex flex-col gap-2 p-1">
            <p className="text-[15px] font-medium tracking-[-0.02em] text-primary">What should we build?</p>
            <p className="text-[13px] leading-5 text-muted-foreground">
              Describe the deck. The AI asks a few questions, proposes a storyline for you to approve, then builds it live in your Library with the WKND layouts.
            </p>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                disabled={!canSend}
                onClick={() => {
                  setInput(example);
                  inputRef.current?.focus();
                }}
                className="cursor-pointer rounded-xl border border-stroke-02 px-3 py-2 text-left text-[13px] text-primary hover:bg-surface-03 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {example}
              </button>
            ))}
          </div>
        ) : null}

        {transcript.map((item) => {
          if (item.kind === "tools") {
            return (
              <ul key={item.key} className="flex flex-col gap-1 self-start px-1">
                {item.lines.map((line) => {
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
          if (item.kind === "deck") {
            return (
              <div key={item.key} className="flex items-center gap-3 self-stretch rounded-2xl border border-stroke-02 p-3">
                <div aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-03 text-primary">
                  <PresentationIcon className="size-4" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-primary">{item.title || "New presentation"}</p>
                  <p className="text-[12px] text-muted-foreground">{serviceConnected ? "Building in your Library" : "Saved by the deck service"}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => onOpenDeck(item.deckId)}>Open deck</Button>
              </div>
            );
          }
          return (
            <div
              key={item.key}
              className={cn(
                "max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[13px] leading-5",
                item.kind === "user" && "self-end bg-primary text-primary-foreground",
                item.kind === "assistant" && "self-start bg-surface-03 text-primary",
                item.kind === "error" && "self-start bg-[#E04E2B]/10 text-[#B3361A]",
                item.kind === "notice" && "self-start px-1 py-0 text-[12px] text-muted-foreground",
              )}
            >
              <FormattedText text={item.text} />
            </div>
          );
        })}

        {chat.busy ? (
          <div className="flex items-center gap-2 self-start px-1 text-[12px] text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            Claude is working…
            <button className="inline-flex cursor-pointer items-center gap-1 underline underline-offset-2" type="button" onClick={() => void chat.stop()}>
              <Square aria-hidden="true" className="size-3" strokeWidth={2.2} />
              Stop
            </button>
          </div>
        ) : null}

        {chat.error ? (
          <p className="self-start rounded-2xl bg-[#E04E2B]/10 px-3 py-2 text-[13px] leading-5 text-[#B3361A]" role="alert">{chat.error}</p>
        ) : null}
      </div>

      <form
        className="flex items-end gap-2 border-t border-stroke-01 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) void submit(input);
        }}
      >
        <textarea
          ref={inputRef}
          aria-label="Message"
          value={input}
          rows={2}
          placeholder={chat.busy ? "Wait for the AI to finish…" : transcript.length ? "Reply…" : "Describe your deck…"}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (canSend) void submit(input);
            }
          }}
          className="max-h-40 min-h-10 flex-1 resize-none rounded-xl border border-stroke-02 bg-surface-01 px-3 py-2 text-[13px] text-primary outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/35"
        />
        <Button aria-label="Send" size="icon" type="submit" disabled={!canSend || !input.trim()}>
          {chat.sending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </Button>
      </form>
    </section>
  );
}
