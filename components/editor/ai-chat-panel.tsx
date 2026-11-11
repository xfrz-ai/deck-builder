"use client";

import { ArrowUp, LoaderCircle, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { AI_BRIDGE_ENABLED, requestSlideEdit, type ChatTurn, type SlideChatKind } from "@/lib/ai/bridge-client";
import {
  checkProposal,
  getSlideChatTarget,
  getTargetContent,
  isTargetCurrent,
  type TextMeasure,
} from "@/lib/ai/slide-chat-target";
import { getCanvasFont, measureTextWidth } from "@/lib/text/measure-text";
import { estimateComponentText } from "@/lib/text/component-text";
import { cn } from "@/lib/utils";
import { selectActiveSlide, useEditorStore } from "@/store/editor-store";


// How many times the AI may fix a proposal the editor rejected.
const MAX_RETRIES = 2;

const EXAMPLES: Record<SlideChatKind, string[]> = {
  team: [
    "Add a Data squad with 3 people",
    "Make every description shorter",
    "Translate the team to Indonesian",
  ],
  agenda: [
    "Add a Q&A item at the end",
    "Make every title shorter",
    "Translate the agenda to Indonesian",
  ],
  timeline: [
    "Add a 2-week QA phase before the last phase",
    "Move every phase one week later",
    "Translate the timeline to Indonesian",
  ],
};

interface ChatMessage extends ChatTurn {
  id: number;
  tone?: "error" | "applied";
}

// Same text measurement as the component forms, so "fits the design" means
// the same thing here.
function useComponentTextMeasure(): TextMeasure {
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      document.fonts.load(getCanvasFont("Plus Jakarta Sans", 24, 400)),
      document.fonts.load(getCanvasFont("Plus Jakarta Sans", 40, 700)),
    ]).then(() => {
      if (mounted) setFontReady(true);
    });
    return () => { mounted = false; };
  }, []);
  return useMemo<TextMeasure>(() => (text, size, weight = 400, spacing = 0) => {
    const width = fontReady ? measureTextWidth(text, "Plus Jakarta Sans", size, weight >= 600 ? 700 : 400) : null;
    return width === null
      ? estimateComponentText(text, size, weight, spacing)
      : width + Math.max(0, Array.from(text).length - 1) * spacing;
  }, [fontReady]);
}

export function AiChatPanel() {
  if (!AI_BRIDGE_ENABLED) return null;
  return <AiChat />;
}

function AiChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const measure = useComponentTextMeasure();

  const activeSlide = useEditorStore(selectActiveSlide);
  const selectedElementIds = useEditorStore((state) => state.selectedElementIds);
  const slides = useEditorStore((state) => state.presentation.slides);
  const applyTeamData = useEditorStore((state) => state.applyTeamData);
  const applyAgendaData = useEditorStore((state) => state.applyAgendaData);
  const applyTimelineData = useEditorStore((state) => state.applyTimelineData);
  const slidesRef = useRef(slides);
  useEffect(() => { slidesRef.current = slides; }, [slides]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const target = useMemo(
    () => getSlideChatTarget(activeSlide, selectedElementIds),
    [activeSlide, selectedElementIds],
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function push(role: ChatTurn["role"], text: string, tone?: ChatMessage["tone"]) {
    const message = { id: nextId.current++, role, text, tone };
    setMessages((current) => [...current, message]);
  }

  async function send(instruction: string) {
    const text = instruction.trim();
    if (!text || busy) return;
    setInput("");
    push("user", text);

    if (!target) {
      push("assistant", "I can edit Team, Agenda and Timeline slides. Select one of those first.", "error");
      return;
    }

    const history = messages.filter((message) => message.tone !== "error").map(({ role, text }) => ({ role, text }));
    const data = getTargetContent(target);
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);

    try {
      let response = await requestSlideEdit({ kind: target.kind, instruction: text, history, data }, controller.signal);
      for (let attempt = 0; ; attempt++) {
        if (!response.data) {
          push("assistant", response.reply || "No changes.");
          return;
        }

        const checked = checkProposal(target, response.data, measure);
        if (checked.kind !== "invalid" && checked.errors.length === 0) {
          // Don't overwrite edits made by hand while the AI was working.
          if (!isTargetCurrent(target, slidesRef.current)) {
            push("assistant", "The slide changed while I was working, so I didn't apply anything. Try again.", "error");
            return;
          }
          if (checked.kind === "team") applyTeamData(target.slideId, checked.data, measure);
          else if (checked.kind === "agenda") applyAgendaData(target.slideId, checked.data, measure);
          else applyTimelineData(target.slideId, checked.data, measure);
          push("assistant", `${response.reply || "Done."} (Ctrl+Z to undo)`, "applied");
          return;
        }

        if (attempt >= MAX_RETRIES) {
          push("assistant", `I couldn't make this fit the design:\n${checked.errors.map((error) => `• ${error}`).join("\n")}`, "error");
          return;
        }
        response = await requestSlideEdit(
          { kind: target.kind, instruction: text, history, data, previousAttempt: response.data, errors: checked.errors },
          controller.signal,
        );
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        push("assistant", error instanceof Error ? error.message : "Something went wrong.", "error");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  }

  return (
    <div className="absolute bottom-3 left-[264px] z-20 flex flex-col items-start gap-2">
      {open ? (
        <section
          aria-label="AI assistant"
          className="flex h-[480px] w-[360px] flex-col overflow-hidden rounded-[1.25rem] border border-stroke-01 bg-surface-01 shadow-popover"
        >
          <header className="flex items-center justify-between border-b border-stroke-01 p-3 pl-4">
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-primary">AI assistant</h2>
              <p className="truncate text-[12px] text-muted-foreground">
                {target ? `Editing ${target.label}` : "Select a Team, Agenda or Timeline slide"}
              </p>
            </div>
            <Button aria-label="Close AI assistant" size="icon-sm" variant="ghost" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </Button>
          </header>

          <div ref={listRef} className="editor-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-2 p-1">
                <p className="text-[13px] leading-5 text-muted-foreground">
                  Tell me what to change on the selected slide. Runs on Claude Code on this machine.
                </p>
                {target ? EXAMPLES[target.kind].map((example) => (
                  <button
                    key={example}
                    type="button"
                    disabled={busy}
                    onClick={() => send(example)}
                    className="cursor-pointer rounded-xl border border-stroke-02 px-3 py-2 text-left text-[13px] text-primary hover:bg-surface-03 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {example}
                  </button>
                )) : null}
              </div>
            ) : null}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-5",
                  message.role === "user"
                    ? "self-end bg-primary text-primary-foreground"
                    : "self-start bg-surface-03 text-primary",
                  message.tone === "error" && "text-destructive",
                )}
              >
                {message.text}
              </div>
            ))}
            {busy ? (
              <div className="flex items-center gap-2 self-start px-1 text-[12px] text-muted-foreground">
                <LoaderCircle className="size-3.5 animate-spin" />
                Claude is working…
                <button
                  type="button"
                  className="cursor-pointer underline underline-offset-2"
                  onClick={() => abortRef.current?.abort()}
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </div>

          <form
            className="flex items-end gap-2 border-t border-stroke-01 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <textarea
              value={input}
              rows={2}
              placeholder={target ? "Describe the change…" : "Select a Team, Agenda or Timeline slide"}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-stroke-02 bg-surface-01 px-3 py-2 text-[13px] text-primary outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/35"
            />
            <Button aria-label="Send" size="icon" type="submit" disabled={busy || !input.trim()}>
              <ArrowUp className="size-4" />
            </Button>
          </form>
        </section>
      ) : null}
      <Button variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Sparkles className="size-4" />
        Ask AI
      </Button>
    </div>
  );
}
