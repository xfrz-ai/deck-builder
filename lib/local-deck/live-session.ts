import type { DeckSnapshot } from "@/lib/deck-service/deck-document";
import type { DeckEvent } from "@/lib/deck-service/event-types";
import { isPresentation } from "@/lib/presentation/validation";
import type { EditorStoreApi } from "@/store/editor-store";
import type { Presentation } from "@/types/presentation";
import { loadLocalDeck, saveLocalDeck, LocalDeckClientError, type BrowserConnection } from "./client";
import { watchDeckEvents, type LiveConnectionStatus } from "./event-client";
import type { PublicAgentWork } from "@/lib/deck-service/work-types";

export interface LiveSessionState {
  revision: number;
  dirty: boolean;
  saving: boolean;
  pendingRevision: number;
  canLoad: boolean;
  connection: LiveConnectionStatus;
  message: string;
  activity: string;
  agentWork?: PublicAgentWork;
  follow: boolean;
  paused: boolean;
  highlightSlideId?: string;
  highlightRevision?: number;
  activities: string[];
  slideCount: number;
  deleted: boolean;
}
export interface SessionTransport {
  load: () => Promise<DeckSnapshot>;
  save: (revision: number, presentation: Presentation, requestId: string) => Promise<DeckSnapshot>;
  watch: (callbacks: { event: (event: DeckEvent) => void; status: (status: LiveConnectionStatus) => void }, signal: AbortSignal) => Promise<void>;
}

// Owns synchronization independently of React render closures. Store replacement,
// baseline and revision changes are published together, so remote data is not dirty.
export class LiveDeckSession {
  private state: LiveSessionState;
  private saved: string;
  private cached?: { presentation: Presentation; serialized: string };
  private pending?: DeckSnapshot;
  private operation?: { revision: number; serialized: string; requestId: string };
  private listeners = new Set<() => void>();
  private unsubscribe?: () => void;
  private abort?: AbortController;
  private retry?: ReturnType<typeof setTimeout>;
  private fetching = false;
  private refreshRequested = false;
  private active = false;
  private generation = 0;
  private applying = false;
  private interacting = false;
  private desiredRevision: number;
  private api: SessionTransport;
  private navigation: string;
  private targets: string[] = [];
  private workRevision: number;
  private initialFocus?: string;

  constructor(private store: EditorStoreApi, document: DeckSnapshot, connection: BrowserConnection, private inputActive: () => boolean = () => false, transport?: SessionTransport, follow = false) {
    this.saved = this.serialized();
    this.desiredRevision = document.revision;
    this.navigation = store.getState().activeSlideId;
    this.workRevision = document.revision;
    this.initialFocus = follow && document.agentWork?.status === "working" ? document.agentWork.lastSlideId : undefined;
    this.state = { revision: document.revision, dirty: false, saving: false, pendingRevision: 0, canLoad: false, connection: "connecting", message: "", activity: "Waiting for the next action", agentWork: document.agentWork, follow, paused: false, activities: [], slideCount: document.presentation.slides.length, deleted: false };
    this.api = transport ?? {
      load: () => loadLocalDeck(connection, document.presentation.id),
      save: (revision, presentation, requestId) => saveLocalDeck(connection, document.presentation.id, revision, presentation, requestId),
      watch: (callbacks, signal) => watchDeckEvents(connection, document.presentation.id, callbacks, signal),
    };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private serialized() {
    const presentation = this.store.getState().presentation;
    if (this.cached?.presentation !== presentation) this.cached = { presentation, serialized: JSON.stringify(presentation) };
    return this.cached.serialized;
  }
  private publish(updates: Partial<LiveSessionState> = {}) {
    const dirty = this.serialized() !== this.saved;
    const next = { ...this.state, ...updates, dirty };
    if (Object.keys(next).some(key => next[key as keyof LiveSessionState] !== this.state[key as keyof LiveSessionState])) {
      this.state = next; for (const listener of this.listeners) listener();
    }
  }
  private blocked() {
    const state = this.store.getState();
    return this.interacting || this.inputActive() || Boolean(state.editingTextId || state.agendaEditor || state.teamEditor || state.timelineEditor);
  }
  setInteracting(value: boolean) { this.interacting = value; if (!value) this.retryApply(); }
  retryApply() { if (this.active) { this.publish(); this.apply(); } }

  start() {
    if (this.active || this.state.deleted) return;
    this.active = true; this.generation++;
    if (this.initialFocus && this.store.getState().presentation.slides.some(slide => slide.id === this.initialFocus)) this.store.getState().selectSlide(this.initialFocus);
    this.initialFocus = undefined; this.navigation = this.store.getState().activeSlideId;
    this.unsubscribe = this.store.subscribe(state => {
      if (this.applying) return;
      if (state.activeSlideId !== this.navigation) { this.navigation = state.activeSlideId; this.publish({ follow: false }); }
      this.retryApply();
    });
    const abort = new AbortController(); this.abort = abort;
    void this.api.watch({
      event: event => { if (!abort.signal.aborted) this.receive(event); },
      status: connection => { if (!abort.signal.aborted) { if (connection === "deleted") this.markDeleted(); else this.publish({ connection }); } },
    }, abort.signal).catch(() => { if (!abort.signal.aborted) this.publish({ connection: "reconnecting" }); });
  }
  stop() {
    this.active = false; this.generation++; this.abort?.abort(); this.unsubscribe?.(); clearTimeout(this.retry);
    this.fetching = false;
  }
  receive(event: DeckEvent) {
    if (this.state.deleted || event.deckId !== this.store.getState().presentation.id) return;
    if (event.type === "document.deleted") { this.markDeleted(); return; }
    if (event.type === "operation.started") {
      if (event.source === "agent") this.record(event.operation === "add" ? "Menambahkan slide" : event.operation === "finish" ? "Menyelesaikan pekerjaan" : event.operation === "start" ? "Memulai pekerjaan" : "Merevisi slide");
      return;
    }
    if (event.type === "operation.failed") { if (event.source === "agent") this.record(`Aksi gagal: ${event.errorCode ?? "UNKNOWN"}`); return; }
    this.desiredRevision = Math.max(this.desiredRevision, event.revision);
    this.publish({
      pendingRevision: this.desiredRevision > this.state.revision ? this.desiredRevision : 0,
      canLoad: Boolean(this.pending && this.pending.revision >= this.desiredRevision),
    });
    if (event.type === "document.committed" && event.source === "agent") {
      this.targets = event.changedSlideIds;
      this.record(`Tersimpan · revisi ${event.revision}`);
    }
    if (event.type === "connection.sync" || event.revision > this.state.revision) this.requestRefresh();
  }
  private record(activity: string) { this.publish({ activity, activities: [...this.state.activities, activity].slice(-12) }); }
  private markDeleted() {
    this.generation++; this.abort?.abort(); clearTimeout(this.retry);
    this.pending = undefined; this.operation = undefined; this.refreshRequested = false; this.fetching = false;
    this.publish({ deleted: true, saving: false, connection: "deleted", canLoad: false, pendingRevision: 0, follow: false, agentWork: undefined, highlightSlideId: undefined, highlightRevision: undefined,
      message: "This presentation was deleted from the Library. Download Draft to keep a copy of this tab.",
    });
  }
  setFollow = (follow: boolean) => { this.publish({ follow }); };
  setPaused = (paused: boolean) => { this.publish({ paused }); if (!paused) this.retryApply(); };
  private requestRefresh() {
    if (this.state.deleted) return;
    this.refreshRequested = true;
    void this.refresh();
  }
  private validate(document: DeckSnapshot) {
    if (!Number.isSafeInteger(document.revision) || document.revision < 1 || !isPresentation(document.presentation) || document.presentation.id !== this.store.getState().presentation.id) throw new Error("Invalid remote deck snapshot. Your draft is unchanged.");
  }
  private async refresh() {
    if (!this.active || this.fetching) return;
    this.fetching = true;
    const generation = this.generation;
    try {
      while (this.active && generation === this.generation && this.refreshRequested) {
        this.refreshRequested = false;
        const document = await this.api.load();
        if (!this.active || generation !== this.generation) return;
        this.validate(document);
        if (document.revision >= this.workRevision) { this.workRevision = document.revision; this.publish({ agentWork: document.agentWork, slideCount: document.presentation.slides.length }); }
        if (document.revision > this.state.revision && (!this.pending || document.revision >= this.pending.revision)) this.pending = document;
        if (document.revision < this.desiredRevision) {
          clearTimeout(this.retry);
          this.retry = setTimeout(() => this.requestRefresh(), 250);
        }
        this.publish({ pendingRevision: Math.max(this.state.revision < this.desiredRevision ? this.desiredRevision : 0, this.pending?.revision ?? 0), canLoad: Boolean(this.pending && this.pending.revision >= this.desiredRevision) });
        this.apply();
      }
    } catch (error) {
      if (this.active && generation === this.generation) {
        if (error instanceof LocalDeckClientError && error.code === "DECK_DELETED") { this.markDeleted(); return; }
        this.publish({ message: error instanceof Error ? error.message : "Live refresh failed. Your draft is unchanged." });
        clearTimeout(this.retry);
        this.retry = setTimeout(() => this.requestRefresh(), 1500);
      }
    } finally { if (generation === this.generation) this.fetching = false; }
  }
  private apply(discardDraft = false, manual = false) {
    const document = this.pending;
    if (!document || document.revision <= this.state.revision || this.state.saving || this.blocked() || document.revision < this.desiredRevision || (this.state.paused && !manual)) return;
    const dirty = this.serialized() !== this.saved;
    if (dirty && !discardDraft) return;
    this.applying = true;
    try {
      const changed = JSON.stringify(document.presentation) !== this.saved;
      if (changed) this.store.getState().applyRemotePresentation(document.presentation);
      const target = this.targets.find(id => document.presentation.slides.some(slide => slide.id === id)) ?? document.agentWork?.lastSlideId;
      if (changed && this.state.follow && target) this.store.getState().selectSlide(target);
      this.navigation = this.store.getState().activeSlideId;
      this.saved = this.serialized();
      this.desiredRevision = document.revision;
      this.pending = undefined; this.operation = undefined;
      this.publish({ revision: document.revision, pendingRevision: 0, canLoad: false,
        ...(changed && this.targets.includes(this.navigation) ? { highlightSlideId: this.navigation, highlightRevision: document.revision } : {}),
        message: changed ? "Live update applied. Undo history was reset for the new server version." : "Status pekerjaan diperbarui.",
      });
    } finally { this.applying = false; }
  }
  loadServer = (discardDraft = false) => { this.apply(discardDraft, true); };

  save = async () => {
    if (this.state.deleted || this.state.saving || !this.state.dirty) return;
    const presentation = this.store.getState().presentation;
    const serialized = this.serialized();
    if (!this.operation || this.operation.serialized !== serialized || this.operation.revision !== this.state.revision) {
      this.operation = { serialized, revision: this.state.revision, requestId: crypto.randomUUID() };
    }
    const operation = this.operation;
    const generation = this.generation;
    this.publish({ saving: true, message: "" });
    try {
      const document = await this.api.save(operation.revision, presentation, operation.requestId);
      if (!this.active || generation !== this.generation) return;
      this.validate(document);
      this.workRevision = document.revision; this.publish({ agentWork: document.agentWork, slideCount: document.presentation.slides.length });
      this.saved = serialized; this.operation = undefined;
      if (this.pending && this.pending.revision <= document.revision) this.pending = undefined;
      this.desiredRevision = Math.max(this.desiredRevision, document.revision);
      this.publish({ revision: document.revision, message: "Saved.", pendingRevision: this.pending?.revision ?? 0, canLoad: Boolean(this.pending) });
    } catch (error) {
      if (!this.active || generation !== this.generation) return;
      if (error instanceof LocalDeckClientError && error.code === "DECK_DELETED") { this.markDeleted(); return; }
      if (error instanceof LocalDeckClientError && error.currentRevision) this.desiredRevision = Math.max(this.desiredRevision, error.currentRevision);
      this.publish({ message: error instanceof Error ? error.message : "Save failed. Your draft is still open." });
      this.requestRefresh();
    } finally {
      if (this.active && generation === this.generation) { this.publish({ saving: false }); this.apply(); }
    }
  };
}
