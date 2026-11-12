// Browser-local library of presentations, stored in IndexedDB.
//
// Slides keep uploaded images inline as data URLs, so a handful of decks would
// overflow localStorage's ~5 MB. IndexedDB holds far more and stores objects
// directly. Each deck is written to two stores in one transaction:
// - "summaries": small records (title, dates, first slide) for the home page.
// - "decks": the full presentation, read only when a deck is opened.

import { createUniqueId } from "@/lib/id";
import { createDefaultPresentation } from "@/lib/presentation/default-presentation";
import {
  EDITOR_STORAGE_KEY,
  normalizePersistedEditorState,
} from "@/lib/presentation/persistence";
import { isPresentation } from "@/lib/presentation/validation";
import type { Presentation, Slide } from "@/types/presentation";

const DB_NAME = "deck-library";
const DB_VERSION = 1;
const SUMMARIES = "summaries";
const DECKS = "decks";
// Set once the single deck saved by earlier versions has been copied in. The
// old key itself is never modified.
const LEGACY_IMPORTED_KEY = "deck-library:legacy-imported";

export interface DeckSummary {
  id: string;
  title: string;
  slideCount: number;
  coverSlide: Slide | null;
  createdAt: number;
  updatedAt: number;
}

export interface DeckRecord {
  id: string;
  presentation: Presentation;
  activeSlideId: string;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser cannot store presentations."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SUMMARIES)) {
        database.createObjectStore(SUMMARIES, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(DECKS)) {
        database.createObjectStore(DECKS, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      // Let a newer tab upgrade the schema instead of blocking it.
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error("Could not open the presentation library."));
    request.onblocked = () => reject(new Error("Close other tabs of this app and try again."));
  }).catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });

  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("The change was not saved."));
  });
}

function summarize(
  presentation: Presentation,
  createdAt: number,
  updatedAt: number,
  id: string,
): DeckSummary {
  return {
    id,
    title: presentation.title,
    slideCount: presentation.slides.length,
    coverSlide: presentation.slides[0] ?? null,
    createdAt,
    updatedAt,
  };
}

async function writeDeck(
  id: string,
  presentation: Presentation,
  activeSlideId: string,
  options: { createdAt?: number; touch?: boolean } = {},
) {
  const database = await openDatabase();
  const transaction = database.transaction([SUMMARIES, DECKS], "readwrite");
  const done = transactionDone(transaction);
  // A failed read below aborts the transaction; the error reaches the caller
  // from that read, so this copy must not surface as unhandled.
  done.catch(() => undefined);
  const summaries = transaction.objectStore(SUMMARIES);
  const existing = await requestResult<DeckSummary | undefined>(summaries.get(id));
  const now = Date.now();
  const createdAt = existing?.createdAt ?? options.createdAt ?? now;
  const updatedAt = options.touch === false && existing ? existing.updatedAt : now;
  const stored: Presentation = { ...presentation, id };

  summaries.put(summarize(stored, createdAt, updatedAt, id));
  transaction.objectStore(DECKS).put({ id, presentation: stored, activeSlideId } satisfies DeckRecord);
  await done;
}

// Copies the deck saved by the single-deck editor into the library, once.
async function importLegacyDeck() {
  let raw: string | null = null;
  try {
    if (window.localStorage.getItem(LEGACY_IMPORTED_KEY)) return;
    raw = window.localStorage.getItem(EDITOR_STORAGE_KEY);
  } catch {
    return;
  }

  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      const state = typeof parsed === "object" && parsed !== null && "state" in parsed ? parsed.state : null;
      if (typeof state === "object" && state !== null && "presentation" in state && isPresentation(state.presentation)) {
        const { presentation, activeSlideId } = normalizePersistedEditorState(state, createDefaultPresentation());
        await writeDeck(createUniqueId("presentation"), presentation, activeSlideId);
      }
    } catch {
      // An unreadable old draft should not block the library.
    }
  }

  try {
    window.localStorage.setItem(LEGACY_IMPORTED_KEY, "1");
  } catch {
    // Without storage the import is retried next time, which is harmless.
  }
}

let legacyImport: Promise<void> | null = null;

export async function listDecks(): Promise<DeckSummary[]> {
  legacyImport ??= importLegacyDeck();
  await legacyImport;

  const database = await openDatabase();
  const transaction = database.transaction(SUMMARIES, "readonly");
  const summaries = await requestResult<DeckSummary[]>(transaction.objectStore(SUMMARIES).getAll());
  return summaries.sort((first, second) => second.updatedAt - first.updatedAt);
}

export async function loadDeck(id: string): Promise<DeckRecord | null> {
  const database = await openDatabase();
  const transaction = database.transaction(DECKS, "readonly");
  const record = await requestResult<DeckRecord | undefined>(transaction.objectStore(DECKS).get(id));
  if (!record || !isPresentation(record.presentation)) return null;

  const normalized = normalizePersistedEditorState(record, record.presentation);
  return { id, ...normalized };
}

// Creates a deck from the given presentation (a blank one by default) and
// returns its id.
export async function createDeck(presentation: Presentation = createDefaultPresentation()) {
  const id = createUniqueId("presentation");
  await writeDeck(id, presentation, presentation.slides[0]?.id ?? "");
  return id;
}

export function saveDeck(
  id: string,
  presentation: Presentation,
  activeSlideId: string,
  options: { touch?: boolean } = {},
) {
  return writeDeck(id, presentation, activeSlideId, options);
}

export async function duplicateDeck(id: string) {
  const record = await loadDeck(id);
  if (!record) throw new Error("That presentation no longer exists.");
  return createDeck({ ...record.presentation, title: `${record.presentation.title || "Untitled Presentation"} (copy)` });
}

export async function deleteDeck(id: string) {
  const database = await openDatabase();
  const transaction = database.transaction([SUMMARIES, DECKS], "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(SUMMARIES).delete(id);
  transaction.objectStore(DECKS).delete(id);
  await done;
}
