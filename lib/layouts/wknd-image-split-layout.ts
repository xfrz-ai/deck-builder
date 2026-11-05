import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutPill,
  createLayoutPlaceholderImage,
  createRotatedLayoutObject,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridX, gridY, LAYOUT_GRID } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import {
  PRESENTATION_HEIGHT,
  PRESENTATION_WIDTH,
  type TextElement,
} from "@/types/presentation";

const ID = "wknd-image-split";
// Cream copy on the left, a photo filling the right side and a portrait
// photo card straddling the seam.
const CONTENT_RIGHT = gridX(LAYOUT_GRID.columns) + LAYOUT_GRID.columnWidth;
const PHOTO_X = 1063;
const CARD = { x: 850, y: 335, width: 446, height: 616 };
const TITLE_SIZE = 130;
// The lead paragraph highlights a phrase in black within grey copy. Text
// elements take one colour, so each line is split into runs; run offsets
// are the measured widths of the text before them at 41px.
const LEAD_SIZE = 41;
const LEAD_LINE_HEIGHT = 1.29;
const LEAD_LINE = LEAD_SIZE * LEAD_LINE_HEIGHT;
const LEAD_TOP = 398;
const LEAD_MUTED = "#9A968C";
const LEAD_RUNS = [
  {
    line: 0,
    lines: 2,
    x: 0,
    color: LEAD_MUTED,
    text: "Lorem ipsum dolor sit amet,\nconsectetur adipiscing elit",
  },
  { line: 1, lines: 1, x: 500, color: WKND_COLORS.black, text: "sed do" },
  {
    line: 2,
    lines: 1,
    x: 0,
    color: WKND_COLORS.black,
    text: "eiusmod tempor incididunt ut labore",
  },
  { line: 2, lines: 1, x: 681, color: LEAD_MUTED, text: "et" },
  {
    line: 3,
    lines: 2,
    x: 0,
    color: LEAD_MUTED,
    text: "dolore magna aliqua, ut enim ad minim\nveniam quis nostrud.",
  },
] as const;

function createLeadRun(
  run: (typeof LEAD_RUNS)[number],
  index: number,
): TextElement {
  return {
    ...createLayoutText({
      id: `${ID}-lead-${index + 1}`,
      text: run.text,
      x: gridX(1) + run.x,
      y: Math.round(LEAD_TOP + run.line * LEAD_LINE),
      // Wide enough that a run never wraps; line breaks are explicit.
      width: 760 - run.x,
      height: Math.ceil(run.lines * LEAD_LINE) + 2,
      fontSize: LEAD_SIZE,
      lineHeight: LEAD_LINE_HEIGHT,
      color: run.color,
    }),
    letterSpacing: -LEAD_SIZE * 0.02,
  };
}

export const WKND_IMAGE_SPLIT_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Split Photo",
  category: "image",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.cream,
    elements: [
      createLayoutPlaceholderImage({
        id: `${ID}-photo`,
        file: "img 3.png",
        x: PHOTO_X,
        y: 0,
        width: PRESENTATION_WIDTH - PHOTO_X,
        height: PRESENTATION_HEIGHT,
        cornerRadius: 0,
      }),
      // Tilted star rising from the bottom edge, tucked behind the card.
      createRotatedLayoutObject({
        id: `${ID}-object`,
        file: "3d-stars.png",
        size: 510,
        center: { x: 798, y: 988 },
        rotation: -10,
      }),
      createLayoutPlaceholderImage({
        id: `${ID}-card`,
        file: "img 2.png",
        ...CARD,
        cornerRadius: 24,
      }),
      ...createFrameElements(ID),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Lorem ipsum",
        x: gridX(1),
        y: gridY(1),
        width: 190,
        height: 50,
        fontSize: 24,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Lorem ipsum",
          x: gridX(1),
          y: 205,
          width: 780,
          height: TITLE_SIZE,
          fontSize: TITLE_SIZE,
          fontWeight: 600,
          lineHeight: 1,
        }),
        letterSpacing: -TITLE_SIZE * 0.04,
      },
      ...LEAD_RUNS.map(createLeadRun),
      createLayoutText({
        id: `${ID}-body`,
        text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        x: gridX(1),
        y: 861,
        width: 480,
        height: Math.ceil(3 * 20 * 1.5) + 2,
        fontSize: 20,
        lineHeight: 1.5,
      }),
      createLayoutText({
        id: `${ID}-intro`,
        text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.",
        x: 1429,
        y: 129,
        width: CONTENT_RIGHT - 1429,
        height: Math.ceil(4 * 22 * 1.55) + 2,
        fontSize: 22,
        lineHeight: 1.55,
        color: WKND_COLORS.white,
      }),
    ],
  },
};
