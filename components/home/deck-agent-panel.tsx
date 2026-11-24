"use client";

import {
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  LoaderCircle,
  Presentation as PresentationIcon,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { FormattedText, toTranscript, ToolLines, useDeckAgentChat } from "@/components/ai/agent-chat";
import { Button } from "@/components/ui/button";
import { SwitchIndicator } from "@/components/ui/switch";
import {
  getAgentState,
  getDeckAgentStatus,
  isAgentReady,
  setActiveAgent,
  type AgentId,
  type AgentInfo,
  type AgentState,
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

function SetupNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl bg-[#E04E2B]/10 p-3 text-[12px] leading-5 text-[#B3361A]" role="alert">
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function agentStatusText(agent: AgentInfo) {
  if (!agent.installed) return "Not installed";
  const version = agent.version ? `v${agent.version}` : "Installed";
  if (agent.loggedIn === false) return `${version} · Not logged in`;
  return agent.loggedIn ? `${version} · Logged in` : version;
}

// The user's own AI agents: what is installed and logged in, and which one
// the chat (and the editor's AI features) use. One agent is on at a time.
function AgentsCard({
  state,
  disabled,
  pending,
  refreshing,
  error,
  onToggle,
  onRefresh,
}: {
  state: AgentState;
  disabled: boolean;
  pending: AgentId | "off" | null;
  refreshing: boolean;
  error: string;
  onToggle: (agent: AgentId, on: boolean) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-stroke-02 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-primary">AI agent</p>
        <button
          className="inline-flex cursor-pointer items-center gap-1 text-[12px] text-muted-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          disabled={refreshing}
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw aria-hidden="true" className={cn("size-3", refreshing && "animate-spin")} strokeWidth={2} />
          Check again
        </button>
      </div>
      <p className="text-[12px] leading-4 text-muted-foreground">
        Runs on your own login on this computer. One agent is on at a time.
      </p>
      <ul className="mt-1 flex flex-col">
        {state.agents.map((agent) => {
          const on = state.active === agent.id;
          const ready = isAgentReady(agent);
          return (
            <li key={agent.id} className="border-t border-stroke-01 first:border-t-0">
              <button
                aria-checked={on}
                className="flex w-full cursor-pointer items-center gap-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed"
                disabled={disabled || pending !== null || (!on && !ready)}
                onClick={() => onToggle(agent.id, !on)}
                role="switch"
                type="button"
              >
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[13px] font-medium", ready ? "text-primary" : "text-muted-foreground")}>{agent.name}</span>
                  <span className="block text-[12px] text-muted-foreground">
                    {agentStatusText(agent)}
                    {on ? " · Active" : ""}
                  </span>
                </span>
                {pending === agent.id || (pending === "off" && on) ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-muted-foreground" />
                ) : null}
                <span className={cn(!on && !ready && "opacity-40")}>
                  <SwitchIndicator checked={on} />
                </span>
              </button>
              {agent.hint ? <p className="pb-2 text-[12px] leading-4 text-[#B3361A]">{agent.hint}</p> : null}
            </li>
          );
        })}
      </ul>
      {state.active === null ? (
        <p className="text-[12px] leading-4 text-muted-foreground">AI is off. Turn on an agent to chat.</p>
      ) : null}
      {error ? <p className="text-[12px] leading-4 text-[#B3361A]" role="alert">{error}</p> : null}
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
  const chat = useDeckAgentChat(CHAT_KEY);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<DeckAgentStatus | null>(null);
  const [bridgeDown, setBridgeDown] = useState(false);
  const [agents, setAgents] = useState<AgentState | null>(null);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [agentPending, setAgentPending] = useState<AgentId | "off" | null>(null);
  const [agentsRefreshing, setAgentsRefreshing] = useState(false);
  const [agentError, setAgentError] = useState("");
  // The agent the current chat runs on, so switching starts a new chat.
  const lastAgent = useRef<AgentId | null>(null);
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

  const applyAgents = useCallback((next: AgentState) => {
    setAgents(next);
    if (next.active && !lastAgent.current) lastAgent.current = next.active;
  }, []);

  // Uses the bridge's last check (it re-checks the CLIs every 30 seconds).
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    // A bridge that isn't running is covered by the bridge notice.
    getAgentState(false, controller.signal).then(applyAgents, () => undefined);
    return () => controller.abort();
  }, [applyAgents, open, bridgeDown]);

  const refreshAgents = async () => {
    setAgentsRefreshing(true);
    try {
      applyAgents(await getAgentState(true));
    } catch {
      // As above.
    } finally {
      setAgentsRefreshing(false);
    }
  };

  const activeAgent = agents?.agents.find((agent) => agent.id === agents.active);
  const agentReady = isAgentReady(activeAgent);

  const toggleAgent = async (agent: AgentId, on: boolean) => {
    setAgentPending(on ? agent : "off");
    setAgentError("");
    try {
      const next = await setActiveAgent(on ? agent : null);
      setAgents(next);
      // A chat stays with its agent: another agent starts a new chat.
      if (next.active && lastAgent.current && next.active !== lastAgent.current && chat.chatId) chat.reset();
      if (next.active) lastAgent.current = next.active;
    } catch (caught) {
      setAgentError(caught instanceof Error ? caught.message : "The AI agent could not be changed.");
      void refreshAgents();
    } finally {
      setAgentPending(null);
    }
  };

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

  // Until the agent list loads (or with an older bridge without it) the bridge
  // itself refuses a chat when no agent is on.
  const canSend = !chat.busy && !chat.sending && !bridgeDown && (agents === null || agentReady);
  const showAgents = Boolean(agents) && !bridgeDown && (agentsOpen || !agentReady);

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
          {agents ? (
            <button
              aria-expanded={showAgents}
              className="flex max-w-full cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground hover:text-primary"
              onClick={() => setAgentsOpen((value) => !value)}
              title="Choose the AI agent"
              type="button"
            >
              <span
                aria-hidden="true"
                className={cn("size-2 shrink-0 rounded-full", agentReady ? "bg-[#2F9E5B]" : activeAgent ? "bg-[#E04E2B]" : "bg-stroke-02")}
              />
              <span className="truncate">
                {activeAgent ? `${activeAgent.name}${agentReady ? "" : " · needs setup"}` : "AI off"}
              </span>
              <ChevronDown aria-hidden="true" className={cn("size-3 shrink-0 transition-transform", showAgents && "rotate-180")} strokeWidth={2} />
            </button>
          ) : (
            <p className="truncate text-[12px] text-muted-foreground">
              {chat.busy ? "Working…" : "Brief, storyline, then a live build"}
            </p>
          )}
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

        {showAgents && agents ? (
          <AgentsCard
            disabled={chat.busy || chat.sending}
            error={agentError}
            onRefresh={() => void refreshAgents()}
            onToggle={(agent, on) => void toggleAgent(agent, on)}
            pending={agentPending}
            refreshing={agentsRefreshing}
            state={agents}
          />
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
          if (item.kind === "tools") return <ToolLines key={item.key} lines={item.lines} />;
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
            {activeAgent?.name ?? "The AI"} is working…
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
          placeholder={chat.busy ? "Wait for the AI to finish…" : agents && !agentReady ? "Turn on an AI agent first…" : transcript.length ? "Reply…" : "Describe your deck…"}
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
