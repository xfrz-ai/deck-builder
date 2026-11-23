// Presentations stored in Supabase (public.decks), with the same API as the
// browser library in lib/presentation/library.ts.
//
// Saves use optimistic concurrency: each deck's last known revision is kept
// here, and an update only applies when the row still has that revision. A
// colleague's save in between surfaces as DeckConflictError instead of being
// overwritten silently.

import { externalizeImages } from "@/lib/cloud/cloud-images";
import { getSupabase, requireUser } from "@/lib/cloud/supabase";
import { createDefaultPresentation } from "@/lib/presentation/default-presentation";
import type { DeckRecord, DeckSummary } from "@/lib/presentation/library";
import * as browserLibrary from "@/lib/presentation/library";
import { normalizePersistedEditorState } from "@/lib/presentation/persistence";
import { isPresentation } from "@/lib/presentation/validation";
import type { Presentation, Slide } from "@/types/presentation";

const SUMMARY_COLUMNS = "id,title,slide_count,cover_slide,created_at,updated_at,owner_id,owner_email";
const ACTIVE_SLIDE_KEY = "deck-builder:active-slide:";
const MIGRATED_KEY = "deck-builder:migrated-browser-decks";

export class DeckConflictError extends Error {
  constructor() {
    super("Someone else saved this presentation while you were editing. Reload to get the latest version; changes after their save weren't stored.");
    this.name = "DeckConflictError";
  }
}

interface SummaryRow {
  id: string;
  title: string;
  slide_count: number;
  cover_slide: Slide | null;
  created_at: string;
  updated_at: string;
  owner_id: string;
  owner_email: string;
}

const revisions = new Map<string, number>();
// Saves of one deck run one after another, so revisions stay in order.
const saveQueues = new Map<string, Promise<unknown>>();

function fail(error: { message: string } | null, fallback: string): never {
  throw new Error(error?.message ? `${fallback} ${error.message}` : fallback);
}

function readActiveSlide(id: string) {
  try {
    return window.localStorage.getItem(ACTIVE_SLIDE_KEY + id) ?? "";
  } catch {
    return "";
  }
}

function rememberActiveSlide(id: string, slideId: string) {
  try {
    window.localStorage.setItem(ACTIVE_SLIDE_KEY + id, slideId);
  } catch {
    // Only the reopen position is lost.
  }
}

function toSummary(row: SummaryRow, userId: string): DeckSummary {
  return {
    id: row.id,
    title: row.title,
    slideCount: row.slide_count,
    coverSlide: row.cover_slide,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
    ownerEmail: row.owner_email,
    isOwner: row.owner_id === userId,
  };
}

export async function listDecks(): Promise<DeckSummary[]> {
  const user = await requireUser();
  const { data, error } = await getSupabase()
    .from("decks")
    .select(SUMMARY_COLUMNS)
    .order("updated_at", { ascending: false })
    .returns<SummaryRow[]>();
  if (error) fail(error, "Presentations could not be loaded.");
  return data.map((row) => toSummary(row, user.id));
}

export async function loadDeck(id: string): Promise<DeckRecord | null> {
  const { data, error } = await getSupabase()
    .from("decks")
    .select("id,presentation,revision")
    .eq("id", id)
    .maybeSingle<{ id: string; presentation: unknown; revision: number }>();
  // An id that isn't a uuid (an old browser link) is simply not found.
  if (error?.code === "22P02") return null;
  if (error) fail(error, "The presentation could not be opened.");
  if (!data || !isPresentation(data.presentation)) return null;

  revisions.set(id, data.revision);
  const presentation: Presentation = { ...data.presentation, id };
  const normalized = normalizePersistedEditorState(
    { presentation, activeSlideId: readActiveSlide(id) },
    presentation,
  );
  return { id, ...normalized };
}

export async function createDeck(presentation: Presentation = createDefaultPresentation()) {
  const user = await requireUser();
  const stored = await externalizeImages(presentation, user.id);
  const { data, error } = await getSupabase()
    .from("decks")
    .insert({ presentation: stored })
    .select("id,revision")
    .single<{ id: string; revision: number }>();
  if (error) fail(error, "The presentation could not be created.");
  revisions.set(data.id, data.revision);
  return data.id;
}

async function writeDeck(id: string, presentation: Presentation) {
  const expected = revisions.get(id);
  if (expected === undefined) throw new Error("Open the presentation again before saving.");

  const user = await requireUser();
  const stored = await externalizeImages({ ...presentation, id }, user.id);
  const { data, error } = await getSupabase()
    .from("decks")
    .update({ presentation: stored, revision: expected + 1 })
    .eq("id", id)
    .eq("revision", expected)
    .select("revision");
  if (error?.code === "40001" || error?.message.includes("REVISION_CONFLICT")) throw new DeckConflictError();
  if (error) fail(error, "Changes could not be saved.");
  // No row: either the revision moved on or access was removed.
  if (data.length === 0) throw new DeckConflictError();
  revisions.set(id, data[0].revision as number);
}

export function saveDeck(
  id: string,
  presentation: Presentation,
  activeSlideId: string,
  options: { touch?: boolean } = {},
) {
  rememberActiveSlide(id, activeSlideId);
  // Moving between slides is remembered on this device only.
  if (options.touch === false) return Promise.resolve();

  const previous = saveQueues.get(id) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => writeDeck(id, presentation));
  saveQueues.set(id, next);
  return next;
}

export async function duplicateDeck(id: string) {
  const record = await loadDeck(id);
  if (!record) throw new Error("That presentation no longer exists.");
  return createDeck({ ...record.presentation, title: `${record.presentation.title || "Untitled Presentation"} (copy)` });
}

// Owners delete the deck for everyone; a collaborator only removes it from
// their own Library.
export async function deleteDeck(id: string) {
  const user = await requireUser();
  const supabase = getSupabase();
  const { data, error } = await supabase.from("decks").delete().eq("id", id).select("id");
  if (error) fail(error, "The presentation could not be deleted.");
  if (data.length > 0) return;

  const { error: leaveError } = await supabase
    .from("deck_shares")
    .delete()
    .eq("deck_id", id)
    .eq("email", user.email);
  if (leaveError) fail(leaveError, "The presentation could not be removed.");
}

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

export async function listShares(deckId: string) {
  const { data, error } = await getSupabase()
    .from("deck_shares")
    .select("email,created_at")
    .eq("deck_id", deckId)
    .order("created_at", { ascending: true })
    .returns<{ email: string; created_at: string }[]>();
  if (error) fail(error, "Sharing settings could not be loaded.");
  return data.map((row) => row.email);
}

export async function addShare(deckId: string, email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Enter a valid email address.");
  const user = await requireUser();
  if (normalized === user.email) throw new Error("You already own this presentation.");

  const { error } = await getSupabase().from("deck_shares").insert({ deck_id: deckId, email: normalized });
  if (error?.code === "23505") throw new Error(`${normalized} already has access.`);
  if (error) fail(error, "The presentation could not be shared.");
  return normalized;
}

export async function removeShare(deckId: string, email: string) {
  const { error } = await getSupabase().from("deck_shares").delete().eq("deck_id", deckId).eq("email", email);
  if (error) fail(error, "Access could not be removed.");
}

// ---------------------------------------------------------------------------
// Moving decks saved in this browser (IndexedDB) to the cloud
// ---------------------------------------------------------------------------

function readMigrated(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(MIGRATED_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeMigrated(migrated: Record<string, string>) {
  try {
    window.localStorage.setItem(MIGRATED_KEY, JSON.stringify(migrated));
  } catch {
    // The banner may show again; moving twice is prevented per deck below.
  }
}

// Browser decks that haven't been moved yet. The browser copies are kept.
export async function listUnmovedBrowserDecks() {
  try {
    const migrated = readMigrated();
    return (await browserLibrary.listDecks()).filter((deck) => !migrated[deck.id]);
  } catch {
    return [];
  }
}

export async function moveBrowserDecksToCloud(onProgress?: (done: number, total: number) => void) {
  const pending = await listUnmovedBrowserDecks();
  const migrated = readMigrated();
  let done = 0;
  for (const summary of pending) {
    const record = await browserLibrary.loadDeck(summary.id);
    if (record) migrated[summary.id] = await createDeck(record.presentation);
    else migrated[summary.id] = "";
    writeMigrated(migrated);
    done += 1;
    onProgress?.(done, pending.length);
  }
  return done;
}

export function dismissBrowserDecks(ids: readonly string[]) {
  const migrated = readMigrated();
  for (const id of ids) migrated[id] ||= "dismissed";
  writeMigrated(migrated);
}
