import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutShape,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridWidth, gridX } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import { createFullTextHeader } from "@/lib/layouts/wknd-full-text-shared";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-full-text-paragraphs";
// Body copy is indented to column 5, with an orange rule in the gutter
// space before it.
const BODY_X = gridX(5);
const BODY_WIDTH = gridWidth(15);
const BODY_TOP = 456;
const BODY_SIZE = 22;
const BODY_LINE_HEIGHT = 1.45;
const BODY_LINE = BODY_SIZE * BODY_LINE_HEIGHT;
const PARAGRAPH_GAP = 22;
const NOTE_TOP = 852;
const NOTE_TEXT_OFFSET = 48;

const PARAGRAPHS = [
  {
    lines: 4,
    text: "The implementation of a structured grid system is the foundational step in transforming a standard slideshow into a high-end visual experience. By establishing a framework based on modular logic, designers can ensure that every element—from heavy data charts to minimalist headlines—aligns to a consistent mathematical rhythm.",
  },
  {
    lines: 3,
    text: "This underlying “invisible skeleton” eliminates guesswork during the assembly of a large project, providing a clear roadmap for where content should live. When elements are snapped to a grid, the entire presentation feels intentional, grounded, and significantly more professional to the audience.",
  },
  {
    lines: 3,
    text: "At the heart of the new financial stack lies Distributed Ledger Technology (DLT). Unlike centralized databases, blockchain provides an immutable, transparent record of transactions that reduces the need for intermediary verification.",
  },
] as const;

// Each paragraph is its own box so the gap between them stays tighter than
// a blank line.
function createParagraphs(): { bottom: number; elements: SlideElement[] } {
  let y = BODY_TOP;
  const elements = PARAGRAPHS.map((paragraph, index) => {
    // Konva drops a line that overflows the box by even a fraction, so round
    // up with a little headroom.
    const height = Math.ceil(paragraph.lines * BODY_LINE) + 2;
    const element = createLayoutText({
      id: `${ID}-paragraph-${index + 1}`,
      text: paragraph.text,
      x: BODY_X,
      y,
      width: BODY_WIDTH,
      height,
      fontSize: BODY_SIZE,
      lineHeight: BODY_LINE_HEIGHT,
    });

    y += height + PARAGRAPH_GAP;
    return element;
  });

  return { bottom: y - PARAGRAPH_GAP, elements };
}

const paragraphs = createParagraphs();

export const WKND_FULL_TEXT_PARAGRAPHS_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Full Text Paragraphs",
  category: "text",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.cream,
    elements: [
      // Upright star whose right arm and lower spoke bleed off the right edge.
      createLayoutObject({
        id: `${ID}-object`,
        file: "3d-stars.png",
        size: 704,
        x: 1524,
        y: 222,
      }),
      ...createFrameElements(ID),
      ...createFullTextHeader({
        id: ID,
        color: WKND_COLORS.black,
        subtitleColor: WKND_COLORS.muted,
      }),
      createLayoutShape({
        id: `${ID}-rule`,
        shapeType: "rectangle",
        x: BODY_X - 44,
        y: BODY_TOP,
        width: 3,
        height: paragraphs.bottom - BODY_TOP,
        fill: WKND_COLORS.orange,
      }),
      ...paragraphs.elements,
      createLayoutText({
        id: `${ID}-note-label`,
        text: "Note",
        x: BODY_X,
        y: NOTE_TOP,
        width: NOTE_TEXT_OFFSET,
        height: 26,
        fontSize: 17,
        fontWeight: 700,
        lineHeight: 1.5,
        color: WKND_COLORS.orange,
      }),
      createLayoutText({
        id: `${ID}-note`,
        text: "By utilizing complex machine learning models, these platforms analyze market volatility and individual risk tolerance in real-time.",
        x: BODY_X + NOTE_TEXT_OFFSET + 8,
        y: NOTE_TOP,
        width: gridWidth(8),
        height: 56,
        fontSize: 18,
        lineHeight: 1.45,
        color: WKND_COLORS.muted,
      }),
    ],
  },
};
