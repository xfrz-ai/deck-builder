"use client";

import { ArrowUp, LoaderCircle, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { FormattedText, toTranscript, ToolLines, useDeckAgentChat } from "@/components/ai/agent-chat";
import { useLocalDeckSession } from "@/components/editor/local-deck-session";
import { Button } from "@/components/ui/button";
import { AI_BRIDGE_ENABLED, requestSlideEdit, type ChatTurn, type SlideChatKind } from "@/lib/ai/bridge-client";
import { getAgentState, isAgentReady, setActiveAgent, type AgentId, type AgentState } from "@/lib/ai/deck-agent-client";
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

// The editor's "Ask AI" panel. With Claude Code · CLI on, it is an agent chat
// on the open deck that can change any slide through the wknd-deck CLI and its
// skill (scripts/deck-agent-chat.mjs). With another agent, or for a deck saved
// only in this browser, it edits the Team, Agenda or Timeline on the slide.

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

const AGENT_EXAMPLES = [
  "Make the title of this slide sharper",
  "Translate this slide to Indonesian",
  "Add a slide after this one with the next steps",
];

const CLI_AGENT: AgentId = "claude-cli";

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
  // The active agent decides which chat opens; undefined while checking, null
  // when the bridge can't be reached.
  const [agents, setAgents] = useState<AgentState | null | undefined>(undefined);
  const [switching, setSwitching] = useState<AgentId | null>(null);
  const [switchError, setSwitchError] = useState("");
  const local = useLocalDeckSession();

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    getAgentState(false, controller.signal).then(
      (state) => setAgents(state),
      () => { if (!controller.signal.aborted) setAgents(null); },
    );
    return () => controller.abort();
  }, [open]);

  // The same setting as the Library's agent card, so it applies there too.
  async function switchAgent(id: AgentId) {
    setSwitching(id);
    setSwitchError("");
    try {
      setAgents(await setActiveAgent(id));
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "The agent could not be switched.");
    } finally {
      setSwitching(null);
    }
  }

  const close = () => setOpen(false);
  const renderSwitch = (busy: boolean) => agents ? (
    <AgentSwitch
      state={agents}
      canUseCli={local !== null}
      busy={busy || switching !== null}
      switching={switching}
      error={switchError}
      onSwitch={(id) => void switchAgent(id)}
    />
  ) : null;
  // The CLI reaches decks in the Library only, not decks saved in this browser.
  const content = agents === undefined
    ? <ChatShell subtitle="Checking your AI agent…" onClose={close}><div className="flex-1" /></ChatShell>
    : agents?.active === CLI_AGENT && local
      ? <AgentChat onClose={close} renderSwitch={renderSwitch} />
      : <ComponentChat onClose={close} renderSwitch={renderSwitch} cliHint={local !== null} />;

  return (
    <div data-ai-chat="" className="absolute bottom-3 left-[264px] z-20 flex flex-col items-start gap-2">
      {open ? content : null}
      <Button variant="outline" size="sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Sparkles className="size-4" />
        Ask AI
      </Button>
    </div>
  );
}

// The two Claude Code paths, side by side so they are easy to compare: the
// MCP-era chat for Team, Agenda and Timeline, and the CLI + skill agent.
const SWITCH_OPTIONS: { id: AgentId; label: string }[] = [
  { id: "claude", label: "Claude Code" },
  { id: CLI_AGENT, label: "CLI + skills" },
];

function AgentSwitch({ state, canUseCli, busy, switching, error, onSwitch }: {
  state: AgentState;
  canUseCli: boolean;
  busy: boolean;
  switching: AgentId | null;
  error: string;
  onSwitch: (id: AgentId) => void;
}) {
  const options = SWITCH_OPTIONS.flatMap((option) => {
    const info = state.agents.find((agent) => agent.id === option.id);
    return info ? [{ ...option, info }] : [];
  });
  if (options.length === 0) return null;
  const activeName = state.agents.find((agent) => agent.id === state.active)?.name;
  const caption = state.active === CLI_AGENT
    ? canUseCli ? "Changes any slide through the wknd-deck CLI and skill." : "CLI + skills works on decks in the Library only."
    : state.active === "claude" ? "Edits the Team, Agenda or Timeline on a slide."
      : activeName ? `${activeName} is on. Pick one to switch.` : "AI is off. Pick an agent to turn it on.";
  return (
    <div className="flex flex-col gap-1.5 border-b border-stroke-01 px-4 py-2.5">
      <div role="radiogroup" aria-label="AI agent" className="flex rounded-xl bg-surface-03 p-0.5">
        {options.map(({ id, label, info }) => {
          const on = state.active === id;
          const ready = isAgentReady(info);
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!on && (busy || !ready)}
              title={ready ? "Also switches the agent in the Library" : info.hint ?? undefined}
              onClick={() => { if (!on) onSwitch(id); }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 py-1 text-[12px] font-medium transition-colors",
                on ? "bg-surface-01 text-primary shadow-toolbar" : "cursor-pointer text-muted-foreground hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted-foreground",
              )}
            >
              {switching === id ? <LoaderCircle aria-hidden="true" className="size-3 animate-spin" /> : null}
              {label}
            </button>
          );
        })}
      </div>
      <p className={cn("text-[11px] leading-4", error ? "text-[#B3361A]" : "text-muted-foreground")} role={error ? "alert" : undefined}>
        {error || caption}
      </p>
    </div>
  );
}

function ChatShell({ subtitle, actions, toolbar, onClose, children }: {
  subtitle: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section
      aria-label="AI assistant"
      className="flex h-[480px] w-[360px] flex-col overflow-hidden rounded-[1.25rem] border border-stroke-01 bg-surface-01 shadow-popover"
    >
      <header className="flex items-center justify-between gap-1 border-b border-stroke-01 p-3 pl-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-primary">AI assistant</h2>
          <p className="truncate text-[12px] text-muted-foreground">{subtitle}</p>
        </div>
        {actions}
        <Button aria-label="Close AI assistant" size="icon-sm" variant="ghost" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </header>
      {toolbar}
      {children}
    </section>
  );
}

function ChatInput({ value, placeholder, disabled, onChange, onSend }: {
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <form
      className="flex items-end gap-2 border-t border-stroke-01 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <textarea
        value={value}
        rows={2}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            onSend();
          }
        }}
        className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-stroke-02 bg-surface-01 px-3 py-2 text-[13px] text-primary outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/35"
      />
      <Button aria-label="Send" size="icon" type="submit" disabled={disabled || !value.trim()}>
        <ArrowUp className="size-4" />
      </Button>
    </form>
  );
}

function ExampleButtons({ examples, disabled, onPick }: { examples: readonly string[]; disabled: boolean; onPick: (example: string) => void }) {
  return examples.map((example) => (
    <button
      key={example}
      type="button"
      disabled={disabled}
      onClick={() => onPick(example)}
      className="cursor-pointer rounded-xl border border-stroke-02 px-3 py-2 text-left text-[13px] text-primary hover:bg-surface-03 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {example}
    </button>
  ));
}

// Scrolls the message list down whenever `key` changes.
function useScrollToEnd(key: string) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [key]);
  return listRef;
}

// Claude Code · CLI working on the open deck. Its commands save to the deck
// service, and the live session brings each change onto the canvas.
function AgentChat({ onClose, renderSwitch }: { onClose: () => void; renderSwitch: (busy: boolean) => ReactNode }) {
  const local = useLocalDeckSession();
  const deckId = useEditorStore((state) => state.presentation.id);
  const slides = useEditorStore((state) => state.presentation.slides);
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const chat = useDeckAgentChat(`deck-agent-editor-chat:${deckId}`);
  const transcript = useMemo(() => toTranscript(chat.events), [chat.events]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const listRef = useScrollToEnd(`${chat.events.length}:${chat.busy}:${chat.error}:${saving}`);

  const slideIndex = slides.findIndex((slide) => slide.id === activeSlideId);
  const deleted = local?.state.deleted ?? false;
  const working = chat.busy || chat.sending || saving;

  async function send(text: string) {
    const message = text.trim();
    if (!message || working || deleted || !local || slideIndex === -1) return;
    // The agent reads the deck from the service, so hand edits are saved
    // first; unsaved edits would also hold back the agent's changes.
    if (local.session.getSnapshot().dirty) {
      setSaving(true);
      try {
        await local.session.save();
      } finally {
        setSaving(false);
      }
      const after = local.session.getSnapshot();
      if (after.dirty) {
        chat.setError(`Your changes couldn't be saved, so the AI didn't start. ${after.message}`.trim());
        return;
      }
    }
    const slide = slides[slideIndex];
    const sent = await chat.send(message, { deckId, slideId: slide.id, slideNumber: slideIndex + 1, slideCount: slides.length });
    if (sent) setInput("");
  }

  return (
    <ChatShell
      subtitle={slideIndex === -1 ? "Claude Code · CLI" : `Slide ${slideIndex + 1} of ${slides.length} · Claude Code · CLI`}
      toolbar={renderSwitch(working)}
      onClose={onClose}
      actions={chat.events.length > 0 ? (
        <Button aria-label="New chat" title="New chat" size="icon-sm" variant="ghost" disabled={working} onClick={() => chat.reset()}>
          <RotateCcw className="size-4" />
        </Button>
      ) : null}
    >
      <div ref={listRef} className="editor-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {chat.events.length === 0 ? (
          <div className="flex flex-col gap-2 p-1">
            <p className="text-[13px] leading-5 text-muted-foreground">
              Ask for any change to this deck: copy, layouts, new slides or their order. Each change is saved to the deck right away, so undo it by asking, not with Ctrl+Z.
            </p>
            <ExampleButtons examples={AGENT_EXAMPLES} disabled={working || deleted} onPick={(example) => void send(example)} />
          </div>
        ) : null}
        {transcript.map((item) => {
          if (item.kind === "tools") return <ToolLines key={item.key} lines={item.lines} />;
          if (item.kind === "deck") return null;
          return (
            <div
              key={item.key}
              className={cn(
                "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[13px] leading-5",
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
        {saving ? (
          <div className="flex items-center gap-2 self-start px-1 text-[12px] text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" />
            Saving your changes first…
          </div>
        ) : null}
        {chat.busy ? (
          <div className="flex items-center gap-2 self-start px-1 text-[12px] text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" />
            The AI is working…
            <button className="inline-flex cursor-pointer items-center gap-1 underline underline-offset-2" type="button" onClick={() => void chat.stop()}>
              <Square aria-hidden="true" className="size-3" strokeWidth={2.2} />
              Stop
            </button>
          </div>
        ) : null}
        {chat.error ? (
          <p className="self-start whitespace-pre-wrap rounded-2xl bg-[#E04E2B]/10 px-3 py-2 text-[13px] leading-5 text-[#B3361A]" role="alert">{chat.error}</p>
        ) : null}
      </div>
      <ChatInput
        value={input}
        placeholder={deleted ? "This deck was deleted" : "Describe the change…"}
        disabled={working || deleted}
        onChange={setInput}
        onSend={() => void send(input)}
      />
    </ChatShell>
  );
}

// One-shot edits of the Team, Agenda or Timeline on the slide, checked and
// applied in the editor as one undo step.
function ComponentChat({ onClose, renderSwitch, cliHint }: { onClose: () => void; renderSwitch: (busy: boolean) => ReactNode; cliHint: boolean }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useScrollToEnd(`${messages.length}:${busy}`);
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
      push("assistant", cliHint
        ? "I can edit Team, Agenda and Timeline slides. Select one of those first, or switch to CLI + skills above to change any slide."
        : "I can edit Team, Agenda and Timeline slides. Select one of those first.", "error");
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
    <ChatShell subtitle={target ? `Editing ${target.label}` : "Select a Team, Agenda or Timeline slide"} toolbar={renderSwitch(busy)} onClose={onClose}>
      <div ref={listRef} className="editor-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-2 p-1">
            <p className="text-[13px] leading-5 text-muted-foreground">
              Tell me what to change on the selected slide. Runs on your AI agent (Claude Code or Codex) on this machine.
            </p>
            {target ? <ExampleButtons examples={EXAMPLES[target.kind]} disabled={busy} onPick={(example) => void send(example)} /> : null}
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
            The AI is working…
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
      <ChatInput
        value={input}
        placeholder={target ? "Describe the change…" : "Select a Team, Agenda or Timeline slide"}
        disabled={busy}
        onChange={setInput}
        onSend={() => void send(input)}
      />
    </ChatShell>
  );
}
