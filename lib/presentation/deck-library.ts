// The Library the app uses: cloud decks (Supabase) when configured, otherwise
// decks saved in this browser. Both share one API.

import * as cloud from "@/lib/cloud/cloud-library";
import { CLOUD_ENABLED } from "@/lib/cloud/supabase";
import * as browser from "@/lib/presentation/library";

export type { DeckRecord, DeckSummary } from "@/lib/presentation/library";
export { DeckConflictError } from "@/lib/cloud/cloud-library";

const library = CLOUD_ENABLED ? cloud : browser;

export const DECKS_IN_CLOUD = CLOUD_ENABLED;
export const listDecks: typeof browser.listDecks = () => library.listDecks();
export const loadDeck: typeof browser.loadDeck = (id) => library.loadDeck(id);
export const createDeck: typeof browser.createDeck = (presentation) => library.createDeck(presentation);
export const saveDeck: typeof browser.saveDeck = (id, presentation, activeSlideId, options) =>
  library.saveDeck(id, presentation, activeSlideId, options);
export const duplicateDeck: typeof browser.duplicateDeck = (id) => library.duplicateDeck(id);
export const deleteDeck: typeof browser.deleteDeck = (id) => library.deleteDeck(id);
