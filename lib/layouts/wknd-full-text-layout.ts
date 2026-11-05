import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutShape,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridWidth, gridX, gridY } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import { createFullTextHeader } from "@/lib/layouts/wknd-full-text-shared";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-full-text";
// Three 6-column text columns from row 7; the right third is left to the W.
const COLUMN_STARTS = [1, 7, 13] as const;
const COLUMN_WIDTH = gridWidth(6);
const COLUMN_TOP = gridY(7);
const W_SIZE = 820;

const COLUMNS = [
  "The implementation of a structured grid system is the foundational step in transforming a standard slideshow into a high-end visual experience. By establishing a framework based on modular logic, designers can ensure that every element—from heavy data charts to minimalist headlines—aligns to a consistent mathematical rhythm.",
  "This underlying “invisible skeleton” eliminates guesswork during the assembly of a large project, providing a clear roadmap for where content should live. When elements are snapped to a grid, the entire presentation feels intentional, grounded, and significantly more professional to the audience.",
  "At the heart of the new financial stack lies Distributed Ledger Technology (DLT). Unlike centralized databases, blockchain provides an immutable, transparent record of transactions that reduces the need for intermediary verification.",
] as const;

function createColumn(text: string, index: number): SlideElement[] {
  const id = `${ID}-column-${index + 1}`;
  const x = gridX(COLUMN_STARTS[index]);

  return [
    {
      ...createLayoutShape({
        id: `${id}-divider`,
        shapeType: "rectangle",
        x,
        y: COLUMN_TOP,
        width: COLUMN_WIDTH,
        height: 1,
        fill: WKND_COLORS.white,
      }),
      opacity: 0.35,
    },
    createLayoutText({
      id: `${id}-number`,
      text: String(index + 1).padStart(2, "0"),
      x,
      y: COLUMN_TOP + 24,
      width: COLUMN_WIDTH,
      height: 22,
      fontSize: 18,
      color: WKND_COLORS.white,
      opacity: 0.6,
    }),
    createLayoutText({
      id: `${id}-body`,
      text,
      x,
      y: COLUMN_TOP + 64,
      width: COLUMN_WIDTH,
      height: 340,
      fontSize: 22,
      lineHeight: 1.55,
      color: WKND_COLORS.white,
    }),
  ];
}

export const WKND_FULL_TEXT_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Full Text Columns",
  category: "text",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      // Both slabs show, with their curved ends bleeding off the right edge.
      createLayoutObject({
        id: `${ID}-object`,
        file: "3d-w.png",
        size: W_SIZE,
        x: 1392,
        y: 100,
      }),
      ...createFrameElements(ID, "light"),
      ...createFullTextHeader({
        id: ID,
        color: WKND_COLORS.white,
        subtitleOpacity: 0.7,
      }),
      createLayoutText({
        id: `${ID}-quote-mark`,
        text: "“",
        x: gridX(1),
        y: gridY(5) - 16,
        width: gridWidth(1) + 24,
        height: 128,
        fontSize: 128,
        fontWeight: 700,
        lineHeight: 1,
        color: WKND_COLORS.orange,
      }),
      {
        ...createLayoutText({
          id: `${ID}-quote`,
          text: "When elements are snapped to a grid, the entire presentation feels intentional, grounded, and significantly more professional.",
          x: gridX(2),
          y: gridY(5),
          width: gridWidth(16),
          height: 100,
          fontSize: 40,
          fontWeight: 500,
          lineHeight: 1.25,
          color: WKND_COLORS.white,
        }),
        letterSpacing: -0.8,
      },
      ...COLUMNS.flatMap(createColumn),
    ],
  },
};
