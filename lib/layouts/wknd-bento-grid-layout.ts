import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutPill,
  createLayoutShape,
  createRotatedLayoutObject,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridX, LAYOUT_GRID } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-bento-grid";
// Copy and a button on the left; a 2×2 grid of cards on the right that
// alternates cream and blue.
const CONTENT_RIGHT = gridX(LAYOUT_GRID.columns) + LAYOUT_GRID.columnWidth;
const TITLE_SIZE = 82;
const GRID_X = 730;
const GRID_GAP = 24;
const CARD_WIDTH = (CONTENT_RIGHT - GRID_X - GRID_GAP) / 2;
const CARD_HEIGHT = 400;
const CARD_ROWS = [128, 128 + CARD_HEIGHT + GRID_GAP] as const;
const CARD_PADDING = 36;
// Narrower than the card's inner width, so body lines break like the design.
const CARD_TEXT_WIDTH = 460;
const BODY_SIZE = 17;
const BODY_LINE_HEIGHT = 1.6;
const BUTTON = { y: 664, width: 208, height: 62 };

const CARDS = [
  { title: "Lorem ipsum", tone: "cream" },
  { title: "Dolor sit amet", tone: "blue" },
  { title: "Consectetur", tone: "blue" },
  { title: "Adipiscing elit", tone: "cream" },
] as const;

const PARAGRAPHS = [
  {
    lines: 3,
    y: 213,
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  },
  {
    lines: 2,
    y: 309,
    text: "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt.",
  },
] as const;

// Konva drops a line that overflows the box by even a fraction.
function textHeight(lines: number, fontSize: number, lineHeight: number) {
  return Math.ceil(lines * fontSize * lineHeight) + 2;
}

function createCard(
  card: (typeof CARDS)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-card-${index + 1}`;
  const x = GRID_X + (index % 2) * (CARD_WIDTH + GRID_GAP);
  const y = CARD_ROWS[Math.floor(index / 2)];
  const isBlue = card.tone === "blue";
  const ink = isBlue ? WKND_COLORS.white : WKND_COLORS.black;
  const contentX = x + CARD_PADDING;

  return [
    createLayoutShape({
      id: `${id}-background`,
      shapeType: "roundedRectangle",
      x,
      y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      cornerRadius: 24,
      fill: isBlue ? WKND_COLORS.blue : WKND_COLORS.cream,
    }),
    ...createLayoutPill({
      id: `${id}-number`,
      text: String(index + 1).padStart(2, "0"),
      x: contentX,
      y: y + 38,
      width: 53,
      height: 34,
      fontSize: 16,
      color: isBlue ? WKND_COLORS.white : WKND_COLORS.muted,
    }),
    {
      ...createLayoutText({
        id: `${id}-title`,
        text: card.title,
        x: contentX,
        y: y + 126,
        width: CARD_TEXT_WIDTH,
        height: 44,
        fontSize: 36,
        fontWeight: 600,
        color: ink,
      }),
      letterSpacing: -36 * 0.03,
    },
    createLayoutText({
      id: `${id}-subtitle`,
      text: "Sed do eiusmod tempor incididunt ut labore",
      x: contentX,
      y: y + 175,
      width: CARD_TEXT_WIDTH,
      height: 25,
      fontSize: 20,
      lineHeight: 1.2,
      color: isBlue ? WKND_COLORS.white : WKND_COLORS.muted,
      opacity: isBlue ? 0.8 : 1,
    }),
    ...PARAGRAPHS.map((paragraph, paragraphIndex) =>
      createLayoutText({
        id: `${id}-paragraph-${paragraphIndex + 1}`,
        text: paragraph.text,
        x: contentX,
        y: y + paragraph.y,
        width: CARD_TEXT_WIDTH,
        height: textHeight(paragraph.lines, BODY_SIZE, BODY_LINE_HEIGHT),
        fontSize: BODY_SIZE,
        lineHeight: BODY_LINE_HEIGHT,
        color: isBlue ? WKND_COLORS.white : WKND_COLORS.muted,
        opacity: isBlue ? 0.85 : 1,
      }),
    ),
  ];
}

export const WKND_BENTO_GRID_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Bento Grid",
  category: "bento",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.black,
    darkMode: true,
    elements: [
      // Tilted W rising from the bottom-left, behind the cards.
      createRotatedLayoutObject({
        id: `${ID}-object`,
        file: "3d-w.png",
        size: 585,
        center: { x: 563, y: 1043 },
        rotation: -12,
      }),
      ...createFrameElements(ID, "light"),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Lorem ipsum",
        x: gridX(1),
        y: 138,
        width: 190,
        height: 50,
        fontSize: 24,
        color: WKND_COLORS.white,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Lorem ipsum\ndolor sit\namet.",
          x: gridX(1),
          y: 206,
          width: 640,
          height: textHeight(3, TITLE_SIZE, 1),
          fontSize: TITLE_SIZE,
          fontWeight: 600,
          lineHeight: 1,
          color: WKND_COLORS.white,
        }),
        letterSpacing: -TITLE_SIZE * 0.04,
      },
      createLayoutText({
        id: `${ID}-body`,
        text: "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
        x: gridX(1),
        y: 499,
        width: 590,
        height: textHeight(4, 22, 1.55),
        fontSize: 22,
        lineHeight: 1.55,
        color: WKND_COLORS.white,
      }),
      createLayoutShape({
        id: `${ID}-button`,
        shapeType: "roundedRectangle",
        x: gridX(1),
        y: BUTTON.y,
        width: BUTTON.width,
        height: BUTTON.height,
        cornerRadius: BUTTON.height / 2,
        fill: WKND_COLORS.cream,
      }),
      createLayoutText({
        id: `${ID}-button-label`,
        text: "Lorem ipsum →",
        x: gridX(1),
        y: BUTTON.y,
        width: BUTTON.width,
        height: BUTTON.height,
        fontSize: 20,
        fontWeight: 600,
        align: "center",
        verticalAlign: "middle",
      }),
      ...CARDS.flatMap(createCard),
    ],
  },
};
