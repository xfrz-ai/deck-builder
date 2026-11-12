"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { DeckSnapshot } from "@/lib/deck-service/deck-document";
import { downloadDraft, type BrowserConnection } from "@/lib/local-deck/client";
import { LiveDeckSession, type LiveSessionState } from "@/lib/local-deck/live-session";
import { useEditorStoreApi } from "@/store/editor-store";
import { useEditorStore } from "@/store/editor-store";
import { workLabel } from "@/lib/local-deck/service-library";
import { WORK_IDLE_MS } from "@/lib/deck-service/work-types";

interface LocalSession { session: LiveDeckSession; state: LiveSessionState; download: () => void }
const Context = createContext<LocalSession | null>(null);

function inputActive() {
  if (globalThis.document?.querySelector('[role="dialog"][aria-modal="true"]')) return true;
  const element = globalThis.document?.activeElement;
  // Checkboxes commit immediately; focusing Follow AI must not freeze its stream.
  if (element instanceof HTMLInputElement && ["checkbox", "radio", "button", "submit", "reset"].includes(element.type)) return false;
  return element instanceof HTMLElement && (element.matches("input,textarea,select") || element.isContentEditable);
}

export function LocalDeckSession({ connection, document, children, follow = false }: {
  connection: BrowserConnection; document: DeckSnapshot; children: ReactNode; follow?: boolean;
}) {
  const store = useEditorStoreApi();
  const [session] = useState(() => new LiveDeckSession(store, document, connection, inputActive, undefined, follow));
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);

  useEffect(() => {
    session.start();
    let pointerDown = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const down = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(".konvajs-content")) {
        clearTimeout(timer); pointerDown = true; session.setInteracting(true);
      }
    };
    const up = () => {
      if (!pointerDown) return;
      clearTimeout(timer);
      // Let Konva's drag/transform end commit before rechecking the pending snapshot.
      timer = setTimeout(() => { pointerDown = false; session.setInteracting(false); }, 0);
    };
    const focusOut = () => { setTimeout(() => session.retryApply(), 0); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const current = session.getSnapshot();
      if (current.dirty || current.saving || store.getState().editingTextId) event.preventDefault();
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("mousedown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("mouseup", up, true);
    window.addEventListener("pointercancel", up, true);
    window.addEventListener("focusout", focusOut);
    window.addEventListener("beforeunload", beforeUnload);
    // Generator dialogs keep unsaved form state outside Zustand. Recheck when a
    // portal closes, even if removing its focused input did not fire focusout.
    const dialogs = new MutationObserver(() => session.retryApply());
    dialogs.observe(globalThis.document.body, { childList: true, subtree: true });
    return () => {
      clearTimeout(timer); dialogs.disconnect(); session.stop();
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("mousedown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("mouseup", up, true);
      window.removeEventListener("pointercancel", up, true);
      window.removeEventListener("focusout", focusOut);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [session, store]);

  return <Context.Provider value={{ session, state, download: () => downloadDraft(store.getState().presentation) }}>{children}</Context.Provider>;
}

export function LocalDeckControls() {
  const value = useContext(Context);
  const [now, setNow] = useState(() => Date.now());
  const work = value?.state.agentWork;
  useEffect(() => {
    if (work?.status !== "working") return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, Date.parse(work.updatedAt) + WORK_IDLE_MS - Date.now() + 50));
    return () => clearTimeout(timer);
  }, [work]);
  if (!value) return null;
  const { session, state, download } = value;
  const status = state.deleted ? "Deleted from Library" : state.connection === "connected" ? "Live connected" : state.connection === "unauthorized" ? "Reconnect with a fresh editor URL" : "Live reconnecting";
  return (
    <div className="flex max-w-[min(700px,90vw)] flex-wrap items-center justify-center gap-3 rounded-xl border border-stroke-01 bg-surface-01 px-3 py-2 shadow-toolbar">
      <div className="min-w-0 text-[10px] text-muted-foreground" role="status" aria-live="polite" data-testid="local-deck-status">
        <div>Local deck · r{state.revision} · {state.dirty ? "Unsaved" : "Saved"} · {status}</div>
        {state.agentWork ? <p data-testid="agent-work-status">{workLabel(state.agentWork, now)} · {state.slideCount}{state.agentWork.plannedSlides ? `/${state.agentWork.plannedSlides}` : ""} slide tersimpan</p> : null}
        {state.paused ? <p>Tampilan dijeda. Agen dan penyimpanan tetap berjalan.</p> : null}
        {state.pendingRevision > state.revision ? <p>Server r{state.pendingRevision} available. Your current draft or interaction is kept.</p> : null}
        {state.message ? <p className="max-h-20 overflow-auto text-[11px]" role="alert">{state.message}</p> : null}
      </div>
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" aria-label="Follow AI" checked={state.follow} disabled={state.deleted} onChange={event => session.setFollow(event.target.checked)} />Follow AI</label>
      <Button size="sm" variant="ghost" aria-label="Pause live view" disabled={state.deleted} onClick={() => session.setPaused(!state.paused)}>{state.paused ? "Lanjut tampilan" : "Jeda tampilan"}</Button>
      {state.canLoad ? <Button size="sm" variant="outline" disabled={state.saving} onClick={() => session.loadServer(state.dirty)} aria-label="Load server version">{state.dirty ? "Discard draft & load" : "Load update"}</Button> : null}
      <Button size="sm" variant="ghost" onClick={download} aria-label="Download local deck draft">Draft</Button>
      <Button size="sm" disabled={state.deleted || !state.dirty || state.saving} onClick={() => { void session.save(); }} aria-label="Save local deck">{state.saving ? "Saving..." : "Save"}</Button>
      {state.activities.length ? <details className="basis-full text-xs text-muted-foreground"><summary className="cursor-pointer">Aktivitas AI · {state.activity}</summary><ol className="mt-2 max-h-28 overflow-auto">{state.activities.map((item, index) => <li key={index}>{item}</li>)}</ol></details> : null}
    </div>
  );
}

export function AgentCanvasHighlight() {
  const value = useContext(Context);
  const active = useEditorStore(state => state.activeSlideId);
  const key = value?.state.highlightRevision ? `${value.state.highlightSlideId}:${value.state.highlightRevision}` : "";
  const [visible, setVisible] = useState("");
  useEffect(() => {
    if (!key) return;
    const frame = requestAnimationFrame(() => setVisible(key));
    const timer = setTimeout(() => setVisible(""), 1400);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [key]);
  if (!value || key !== visible || active !== value.state.highlightSlideId) return null;
  return <div data-testid="agent-canvas-highlight" aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 border-[3px] border-primary motion-safe:animate-pulse"><span className="absolute bottom-2 right-2 rounded-lg bg-surface-01 px-2 py-1 text-xs text-primary shadow-toolbar">AI memperbarui slide</span></div>;
}
