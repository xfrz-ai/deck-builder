import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutPill,
  createLayoutShape,
  createRotatedLayoutObject,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridWidth, gridX, gridY } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-full-text-statement";
// Three equal columns splitting the left 16 grid columns, from row 2.
const COLUMNS_WIDTH = gridWidth(16);
const COLUMN_GAP = 24;
const COLUMN_WIDTH = Math.floor((COLUMNS_WIDTH - COLUMN_GAP * 2) / 3);
const COLUMN_TOP = gridY(2);
// Room for one more line than the sample copy needs.
const COLUMN_BODY_LINES = 10;
const BODY_SIZE = 21;
const BODY_LINE_HEIGHT = 1.58;
const TITLE_SIZE = 152;
const TITLE_LINE_HEIGHT = 0.98;
// Title and subtitle share a bottom edge just above the footer.
const BOTTOM = 936;
const SUBTITLE_LINES = 4;
const SUBTITLE_LINE_HEIGHT = 1.45;

const COLUMNS = [
  "The implementation of a structured grid system is the foundational step in transforming a standard slideshow into a high-end visual experience. By establishing a framework based on modular logic, designers can ensure that every element—from heavy data charts to minimalist headlines—aligns to a consistent mathematical rhythm.",
  "This underlying “invisible skeleton” eliminates guesswork during the assembly of a large project, providing a clear roadmap for where content should live. When elements are snapped to a grid, the entire presentation feels intentional, grounded, and significantly more professional to the audience.",
  "At the heart of the new financial stack lies Distributed Ledger Technology (DLT). Unlike centralized databases, blockchain provides an immutable, transparent record of transactions that reduces the need for intermediary verification.",
] as const;

function columnX(index: number) {
  return Math.round(gridX(1) + index * ((COLUMNS_WIDTH + COLUMN_GAP) / 3));
}

function createColumn(text: string, index: number): SlideElement[] {
  const id = `${ID}-column-${index + 1}`;
  const x = columnX(index);

  return [
    {
      ...createLayoutShape({
        id: `${id}-divider`,
        shapeType: "rectangle",
        x,
        y: COLUMN_TOP,
        width: COLUMN_WIDTH,
        height: 1,
        fill: WKND_COLORS.black,
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
      opacity: 0.7,
    }),
    createLayoutText({
      id: `${id}-body`,
      text,
      x,
      y: COLUMN_TOP + 54,
      width: COLUMN_WIDTH,
      // Konva drops a line that overflows the box by even a fraction.
      height: Math.ceil(COLUMN_BODY_LINES * BODY_SIZE * BODY_LINE_HEIGHT) + 2,
      fontSize: BODY_SIZE,
      lineHeight: BODY_LINE_HEIGHT,
    }),
  ];
}

const titleHeight = Math.ceil(TITLE_SIZE * TITLE_LINE_HEIGHT * 2);
const subtitleHeight = Math.ceil(24 * SUBTITLE_LINE_HEIGHT * SUBTITLE_LINES) + 2;

export const WKND_FULL_TEXT_STATEMENT_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Full Text Statement",
  category: "text",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.yellow,
    elements: [
      // Tilted star; its right arm bleeds off the right edge.
      createRotatedLayoutObject({
        id: `${ID}-object`,
        file: "3d-stars.png",
        size: 800,
        center: { x: 1606, y: 496 },
        rotation: 12,
      }),
      ...createFrameElements(ID),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Design Systems",
        x: gridX(1),
        y: gridY(1),
        width: 222,
        height: 50,
        fontSize: 24,
      }),
      ...COLUMNS.flatMap(createColumn),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Write title here",
          x: gridX(1),
          y: BOTTOM - titleHeight,
          width: gridWidth(10),
          height: titleHeight,
          fontSize: TITLE_SIZE,
          fontWeight: 600,
          lineHeight: TITLE_LINE_HEIGHT,
        }),
        letterSpacing: -TITLE_SIZE * 0.04,
      },
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.",
        x: columnX(2),
        y: BOTTOM - subtitleHeight,
        width: 340,
        height: subtitleHeight,
        fontSize: 24,
        lineHeight: SUBTITLE_LINE_HEIGHT,
        opacity: 0.8,
      }),
    ],
  },
};
