import { createHash } from "node:crypto";
import { z } from "zod";
import { buildDeckFromSpec, getKnownLayoutIds, MAX_DECK_SLIDES } from "@/lib/deck-spec/build-deck";
import { getDeckSpecCatalog } from "@/lib/deck-spec/layout-catalog";
import type { DeckSpec } from "@/lib/deck-spec/deck-spec";
import { normalizeAgendaPresentation } from "@/lib/agenda/agenda-ownership";
import { normalizeTeamPresentation } from "@/lib/team/team-ownership";
import { normalizeTimelinePresentation } from "@/lib/timeline/timeline-ownership";
import { normalizeTablePresentation } from "@/lib/table/table-migration";
import { isPresentation } from "@/lib/presentation/validation";
import { LAYOUT_GRID } from "@/lib/layouts/layout-grid";
import { WKND_COLORS } from "@/lib/layouts/layout-elements";
import { DECK_THEMES, WKND_3D_DIR } from "@/lib/themes/deck-themes";
import type { Presentation } from "@/types/presentation";
import { DeckError, snapshot, type DeckDocument } from "./deck-document";
import { FileRepository } from "./file-repository";
import { addSchema, createSchema, saveSchema, updateSchema, startWorkSchema, finishWorkSchema, deleteSchema } from "./schemas";
import { WORK_IDLE_MS, type AgentWork } from "./work-types";
import { DeckEvents } from "./events";
import type { EventInput } from "./event-types";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter(k => record[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(record[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
export function hash(value: unknown) { return createHash("sha256").update(canonical(value)).digest("hex"); }
function normalize(presentation: Presentation) {
  return normalizeTablePresentation(normalizeTimelinePresentation(normalizeTeamPresentation(normalizeAgendaPresentation(presentation))));
}

function validatePresentation(value: unknown): asserts value is Presentation {
  if (!isPresentation(value)) throw new DeckError("INVALID_PRESENTATION", "The editor snapshot does not match the Presentation schema.");
  if (value.slides.length > MAX_DECK_SLIDES) throw new DeckError("SLIDE_LIMIT", "A local deck holds at most 60 slides.");
  // Only actual image sources are checked here; ordinary text may contain website names.
  for (const slide of value.slides) {
    for (const element of slide.elements) {
      if (element.type === "image" && !isLocalImage(element.src)) throw new DeckError("EXTERNAL_ASSET", "Images must use /assets/ paths or embedded data images.");
      if (element.themeBase?.src && !isLocalImage(element.themeBase.src)) throw new DeckError("EXTERNAL_ASSET", "Theme image sources must be local.");
    }
    if (slide.team) for (const person of [...slide.team.groups.flatMap(group => group.members), ...(slide.team.leader ? [slide.team.leader] : [])]) {
      if (person.photo && !isLocalImage(person.photo.src)) throw new DeckError("EXTERNAL_ASSET", "Team photos must be local.");
    }
  }
}
function isLocalImage(src: string) {
  if (/^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=\s]+$/i.test(src)) return true;
  if (!src.startsWith("/assets/") || src.includes("\\")) return false;
  try {
    const decoded = decodeURIComponent(src);
    return !decoded.split("/").includes("..") && new URL(src, "http://127.0.0.1").pathname.startsWith("/assets/");
  } catch { return false; }
}

export class DeckService {
  readonly events = new DeckEvents();
  constructor(readonly repository: FileRepository) {}

  layouts(category?: string, layoutId?: string) {
    const catalog = getDeckSpecCatalog();
    const layouts = catalog.layouts.filter(item => (!category || item.category === category) && (!layoutId || item.id === layoutId));
    if (layoutId && !layouts.length) throw new DeckError("UNSUPPORTED_LAYOUT", `Layout '${layoutId}' is not supported by DeckSpec. Use list_layouts for the 31 supported layouts.`);
    return { ...catalog, layouts, maxSlides: MAX_DECK_SLIDES };
  }
  brand() {
    return { themes: DECK_THEMES, palette: WKND_COLORS, fontFamily: "Plus Jakarta Sans", width: 1920, height: 1080, grid: LAYOUT_GRID, object3dDirectory: WKND_3D_DIR };
  }
  private expose(document: DeckDocument) {
    const result = snapshot(document);
    if (result.agentWork?.status === "working" && (document.agentWork!.serviceInstance !== this.events.instance || Date.now() - Date.parse(result.agentWork.updatedAt) > WORK_IDLE_MS)) result.agentWork.status = "interrupted";
    return result;
  }
  async get(deckId: string) { return this.expose(await this.repository.read(deckId)); }
  async list() {
    const results = await Promise.allSettled((await this.repository.ids()).map(id => this.get(id)));
    return {
      decks: results.flatMap(result => result.status === "fulfilled" ? [{
        id: result.value.presentation.id, title: result.value.presentation.title, slideCount: result.value.presentation.slides.length,
        createdAt: Date.parse(result.value.createdAt ?? result.value.updatedAt), updatedAt: Date.parse(result.value.updatedAt),
        revision: result.value.revision, agentWork: result.value.agentWork,
      }] : []),
      unavailableCount: results.filter(result => result.status === "rejected" && !(result.reason instanceof DeckError && result.reason.code === "DECK_DELETED")).length,
    };
  }
  private newWork(requestId: string, ownerToken: string, plannedSlides?: number): AgentWork {
    return { id: `run-${hash(requestId).slice(0, 32)}`, status: "working", plannedSlides, updatedAt: new Date().toISOString(), ownerHash: hash(ownerToken), serviceInstance: this.events.instance };
  }

  async remove(input: z.input<typeof deleteSchema>) {
    const args = deleteSchema.parse(input);
    return this.repository.transaction(async () => {
      let document: DeckDocument;
      try { document = await this.repository.read(args.deckId); }
      catch (error) {
        if (error instanceof DeckError && error.code === "DECK_DELETED") return { deckId: args.deckId };
        throw error;
      }
      if (document.revision !== args.expectedRevision) throw new DeckError("REVISION_CONFLICT", "The presentation changed. Review the latest Library version before deleting it again.", 409, [], document.revision);
      await this.repository.remove(args.deckId, document.revision + 1);
      this.events.publish({ type: "document.deleted", deckId: args.deckId, revision: document.revision + 1, source: "editor", operation: "delete", changedSlideIds: [] });
      return { deckId: args.deckId };
    });
  }
  private requireOwner(document: DeckDocument, context?: { runId?: string; ownerToken?: string }) {
    const work = document.agentWork;
    if (!work || work.status !== "working") throw new DeckError("WORK_NOT_ACTIVE", "Start a new deck run before continuing this live job.", 409);
    if (work.serviceInstance !== this.events.instance || Date.now() - Date.parse(work.updatedAt) > WORK_IDLE_MS) throw new DeckError("WORK_INTERRUPTED", "The service restarted or this job became idle. Read the deck and start a new run to resume safely.", 409);
    if (work.id !== context?.runId || !context.ownerToken || work.ownerHash !== hash(context.ownerToken)) throw new DeckError("WORK_OWNER_REQUIRED", "This deck has an active agent. Supply its runId and ownerToken, or wait until the job is interrupted.", 409);
  }

  private build(spec: DeckSpec) {
    const supported = new Set(getKnownLayoutIds());
    spec.slides.forEach((slide, i) => {
      if (!supported.has(slide.layout)) throw new DeckError("UNSUPPORTED_LAYOUT", `Layout '${slide.layout}' is not supported by DeckSpec. Use list_layouts for the 31 supported layouts.`, 400, [{ path: `slides[${i}].layout`, message: "Unsupported layout." }]);
    });
    // Validate sources after building too, so all generated/hidden sources are checked.
    const result = buildDeckFromSpec(spec);
    if (result.errors.length) throw new DeckError("BUILD_FAILED", "The deck did not pass builder validation. Fix the reported fields.", 400, result.errors);
    const presentation = normalize(result.presentation);
    validatePresentation(presentation);
    return { presentation, warnings: result.warnings };
  }

  async create(input: z.input<typeof createSchema>, ownerToken?: string) {
    const args = createSchema.parse(input);
    if (args.live && (!ownerToken || args.spec.slides.length !== 1)) throw new DeckError("LIVE_START_ONE_SLIDE", "Live creation starts with one cover slide; then add slides incrementally and finish_deck when done.");
    return this.repository.transaction(async () => {
      // Deterministic identity makes create retries safe even across a service restart.
      const deckId = `deck-${hash(args.requestId).slice(0, 32)}`;
      const fingerprint = hash({ operation: "create", spec: args.spec, ...(args.live ? { live: true, plannedSlides: args.plannedSlides } : {}) });
      try {
        const existing = await this.repository.read(deckId);
        this.replay(existing, args.requestId, fingerprint);
        return this.expose(existing);
      } catch (error) { if (!(error instanceof DeckError) || error.code !== "DECK_NOT_FOUND") throw error; }
      const activity: EventInput = { type: "operation.started", deckId, revision: 1, requestId: args.requestId, operation: "create", source: "agent", changedSlideIds: [] };
      this.events.publish(activity);
      try {
      const built = this.build(args.spec);
      built.presentation.id = deckId;
      const document: DeckDocument = {
        storageVersion: 1, revision: 1, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
        ...(args.live ? { agentWork: this.newWork(args.requestId, ownerToken!, args.plannedSlides) } : {}),
        presentation: built.presentation,
        defaults: { theme: args.spec.theme, footer: args.spec.footer },
        sources: Object.fromEntries(built.presentation.slides.map((slide, i) => [slide.id, { spec: args.spec.slides[i], builtHash: hash(slide), stale: false }])),
        warnings: built.warnings, validation: "estimated",
        receipts: { [args.requestId]: { fingerprint, revision: 1 } },
      };
      await this.repository.write(document);
      this.events.publish({ ...activity, type: "document.committed", changedSlideIds: document.presentation.slides.map(slide => slide.id) });
      return this.expose(document);
      } catch (error) {
        this.events.publish({ ...activity, type: "operation.failed", errorCode: error instanceof DeckError ? error.code : "INTERNAL_ERROR" });
        throw error;
      }
    });
  }

  private replay(document: DeckDocument, requestId: string, fingerprint: string) {
    const receipt = Object.hasOwn(document.receipts, requestId) ? document.receipts[requestId] : undefined;
    if (!receipt) return false;
    if (receipt.fingerprint !== fingerprint) throw new DeckError("REQUEST_ID_REUSED", "Use a new requestId for different operation content.", 409);
    return true;
  }

  private mutate(deckId: string, expectedRevision: number, requestId: string, operation: "add" | "update" | "save" | "start" | "finish", payload: unknown, apply: (doc: DeckDocument) => void, owner?: { runId?: string; ownerToken?: string }) {
    return this.repository.transaction(async () => {
      const document = await this.repository.read(deckId);
      const fingerprint = hash({ operation, payload });
      if (this.replay(document, requestId, fingerprint)) {
        const appliedRevision = document.receipts[requestId].revision;
        if (appliedRevision !== document.revision) {
          throw new DeckError("REQUEST_ALREADY_APPLIED", `This request was saved at revision ${appliedRevision}, and newer changes now exist. Keep your draft and reload the latest deck before reconciling.`, 409, [], document.revision);
        }
        return this.expose(document);
      }
      const activity: EventInput = { type: "operation.started", deckId, revision: document.revision, requestId, operation, source: operation === "save" ? "editor" : "agent", changedSlideIds: [] };
      this.events.publish(activity);
      try {
      if (document.revision !== expectedRevision) throw new DeckError("REVISION_CONFLICT", "The deck changed. Keep your draft, get the latest deck, and reconcile before saving again.", 409, [], document.revision);
      if (operation === "finish" || ((operation === "add" || operation === "update") && (document.agentWork?.status === "working" || owner?.runId || owner?.ownerToken))) this.requireOwner(document, owner);
      const previous = new Map(document.presentation.slides.map(slide => [slide.id, hash(slide)]));
      document.createdAt ??= document.updatedAt;
      apply(document);
      validatePresentation(document.presentation);
      document.revision++;
      document.updatedAt = new Date().toISOString();
      document.receipts[requestId] = { fingerprint, revision: document.revision };
      const current = new Map(document.presentation.slides.map(slide => [slide.id, hash(slide)]));
      const changedSlideIds = [...new Set([...previous.keys(), ...current.keys()])].filter(id => previous.get(id) !== current.get(id));
      if (operation !== "save" && document.agentWork?.status === "working") {
        document.agentWork.updatedAt = document.updatedAt;
        document.agentWork.lastSlideId = changedSlideIds.at(-1) ?? document.agentWork.lastSlideId;
        // Work metadata and presentation share one atomic document commit.
      }
      await this.repository.write(document);
      this.events.publish({ ...activity, type: "document.committed", revision: document.revision, changedSlideIds });
      return this.expose(document);
      } catch (error) {
        this.events.publish({ ...activity, type: "operation.failed", errorCode: error instanceof DeckError ? error.code : "INTERNAL_ERROR" });
        throw error;
      }
    });
  }

  async add(input: z.input<typeof addSchema>) {
    const args = addSchema.parse(input);
    return this.mutate(args.deckId, args.expectedRevision, args.requestId, "add", args, document => {
      if (document.presentation.slides.length >= MAX_DECK_SLIDES) throw new DeckError("SLIDE_LIMIT", "A local deck holds at most 60 slides.");
      const after = args.afterSlideId ? document.presentation.slides.findIndex(s => s.id === args.afterSlideId) : document.presentation.slides.length - 1;
      if (after < 0) throw new DeckError("SLIDE_NOT_FOUND", "Insertion target slide not found.", 404);
      const built = this.build({ ...document.defaults, slides: [args.slideSpec] });
      const slide = built.presentation.slides[0];
      document.presentation.slides.splice(after + 1, 0, slide);
      document.sources[slide.id] = { spec: args.slideSpec, builtHash: hash(slide), stale: false };
      document.warnings = built.warnings;
    }, args);
  }

  async update(input: z.input<typeof updateSchema>) {
    const args = updateSchema.parse(input);
    return this.mutate(args.deckId, args.expectedRevision, args.requestId, "update", args, document => {
      const index = document.presentation.slides.findIndex(s => s.id === args.slideId);
      if (index < 0) throw new DeckError("SLIDE_NOT_FOUND", "Slide not found.", 404);
      const source = Object.hasOwn(document.sources, args.slideId) ? document.sources[args.slideId] : undefined;
      if ((!source || source.stale || source.builtHash !== hash(document.presentation.slides[index])) && !(args.slideSpec && args.replaceManual)) {
        throw new DeckError("SLIDE_SOURCE_STALE", "This slide has manual changes. Supply a complete slideSpec and replaceManual:true to explicitly rebuild it.", 409);
      }
      const spec = args.slideSpec ?? { ...source!.spec, content: { ...source!.spec.content, ...args.contentPatch } };
      const built = this.build({ ...document.defaults, slides: [spec] });
      const slide = { ...built.presentation.slides[0], id: args.slideId };
      document.presentation.slides[index] = slide;
      document.sources[args.slideId] = { spec, builtHash: hash(slide), stale: false };
      document.warnings = built.warnings;
    }, args);
  }

  async startWork(input: z.input<typeof startWorkSchema>, ownerToken: string) {
    const args = startWorkSchema.parse(input);
    return this.mutate(args.deckId, args.expectedRevision, args.requestId, "start", args, document => {
      if (this.expose(document).agentWork?.status === "working") throw new DeckError("WORK_BUSY", "Another agent run is still active on this deck.", 409);
      document.agentWork = this.newWork(args.requestId, ownerToken, args.plannedSlides);
    });
  }

  async finishWork(input: z.input<typeof finishWorkSchema>) {
    const args = finishWorkSchema.parse(input);
    return this.mutate(args.deckId, args.expectedRevision, args.requestId, "finish", args, document => {
      const work = document.agentWork!;
      if (args.status === "completed" && work.plannedSlides && document.presentation.slides.length !== work.plannedSlides) throw new DeckError("INCOMPLETE_DECK", `The plan is ${work.plannedSlides} slides, but ${document.presentation.slides.length} are saved. Add the remaining slides or finish as partial.`);
      work.status = args.status; work.summary = args.summary; work.updatedAt = new Date().toISOString();
    }, args);
  }

  async save(input: z.input<typeof saveSchema>) {
    const args = saveSchema.parse(input);
    validatePresentation(args.presentation);
    const presentation = normalize(args.presentation);
    if (presentation.id !== args.deckId) throw new DeckError("DECK_ID_MISMATCH", "Saving cannot change the deck identity.");
    return this.mutate(args.deckId, args.expectedRevision, args.requestId, "save", args, document => {
      const sources: DeckDocument["sources"] = {};
      for (const slide of presentation.slides) {
        const source = Object.hasOwn(document.sources, slide.id) ? document.sources[slide.id] : undefined;
        if (source) sources[slide.id] = { ...source, stale: source.builtHash !== hash(slide) };
      }
      document.sources = sources;
      document.presentation = presentation;
    });
  }
}
