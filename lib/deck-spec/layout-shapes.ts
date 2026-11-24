// What each deck-spec layout looks like, as opposed to what it is for (its
// category). Agents filter by shape when the user asks for a slide by its
// look, e.g. "two columns, text and a photo" → `layouts --shape text-image`.

export const LAYOUT_SHAPES = {
  "text-image": "Text next to or over one or more photos",
  "full-bleed": "A photo fills the whole slide behind the text",
  "two-column": "Content in two columns side by side",
  "three-column": "Content in three columns side by side",
  "four-column": "Content in four columns side by side",
  grid: "A 2×2 grid",
  cards: "Content in separate cards",
  list: "A vertical list of items",
  statement: "One huge title or line carries the slide",
  quote: "A pull quote",
  numbers: "Big figures or metrics",
  "text-only": "Text without photos",
  table: "Rows and columns of data",
  diagram: "A chart of people or phases: org charts, roads, steps, roadmaps",
} as const;

export type LayoutShape = keyof typeof LAYOUT_SHAPES;

export const SHAPES_BY_LAYOUT: Record<string, readonly LayoutShape[]> = {
  "wknd-cover-brand": ["statement"],
  "wknd-cover-star": ["statement"],
  "wknd-cover-arches": ["statement"],
  "wknd-cover-d": ["statement"],
  "wknd-agenda": ["list", "table"],
  "wknd-agenda-chapters": ["list"],
  "wknd-agenda-overview": ["cards"],
  "wknd-agenda-spotlight": ["list"],
  "wknd-team-structure": ["diagram", "cards"],
  "wknd-team-squads": ["cards"],
  "wknd-team-org": ["diagram"],
  "wknd-team-tree": ["diagram"],
  "wknd-timeline-road": ["diagram"],
  "wknd-timeline-steps": ["diagram"],
  "wknd-timeline-roadmap": ["diagram"],
  "wknd-table-packages": ["table"],
  "wknd-table-scope": ["table"],
  "wknd-table-bug-triage": ["table"],
  "wknd-image-moods": ["text-image", "four-column"],
  "wknd-image-materials": ["text-image", "grid"],
  "wknd-image-chapter": ["full-bleed", "statement"],
  "wknd-image-field-notes": ["text-image", "two-column"],
  "wknd-image-two-studies": ["text-image", "two-column"],
  "wknd-image-approach": ["full-bleed", "three-column", "cards"],
  "wknd-image-text-photo": ["text-image", "two-column"],
  "wknd-image-photo-text": ["text-image", "two-column"],
  "wknd-bento-columns": ["cards", "three-column", "text-only"],
  "wknd-bento-grid": ["cards", "grid", "text-only"],
  "wknd-full-text": ["two-column", "three-column", "quote", "text-only"],
  "wknd-full-text-paragraphs": ["list", "text-only"],
  "wknd-full-text-statement": ["statement", "two-column", "three-column", "text-only"],
  "wknd-stats": ["numbers", "two-column", "three-column", "four-column", "text-only"],
  "wknd-thank-you": ["statement"],
  "wknd-questions": ["statement", "three-column"],
};

export function isLayoutShape(value: string): value is LayoutShape {
  return Object.hasOwn(LAYOUT_SHAPES, value);
}
