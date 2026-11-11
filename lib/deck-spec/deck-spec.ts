import type { ThemeId } from "@/lib/themes/deck-themes";
import type { Presentation } from "@/types/presentation";

// A deck spec is what an outside tool or agent sends to build a WKND deck:
// it picks a layout per slide and fills that layout's content fields. The
// layouts own every position, color and font, so specs cannot break the
// brand. See `getDeckSpecCatalog()` for the fields of each layout.
export const DECK_SPEC_VERSION = 1;

export interface DeckSpec {
  version?: typeof DECK_SPEC_VERSION;
  title?: string;
  // Recolors every slide with a deck theme. Leave it out to keep each
  // layout's own colors.
  theme?: ThemeId;
  // The small text at the bottom of every slide.
  footer?: { left?: string; note?: string };
  slides: DeckSlideSpec[];
}

export interface DeckSlideSpec {
  layout: string;
  theme?: ThemeId;
  content?: Record<string, unknown>;
}

export interface DeckSpecIssue {
  // Where the problem is, e.g. "slides[2].content.columns[1].body".
  path: string;
  message: string;
}

export interface DeckBuildResult {
  // Every slide that could be built. Slides with structural errors (unknown
  // layout, wrong shape) are left out; slides whose text does not fit are
  // kept so they can be fixed in the editor.
  presentation: Presentation;
  errors: DeckSpecIssue[];
  warnings: DeckSpecIssue[];
}

// Same signature as the component text measures: the width of one line.
export type DeckTextMeasure = (text: string, size: number, weight?: number, spacing?: number) => number;
