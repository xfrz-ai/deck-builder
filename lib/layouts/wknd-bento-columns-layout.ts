import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutPill,
  createLayoutShape,
  createRotatedLayoutObject,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridWidth, gridX, LAYOUT_GRID } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-bento-columns";
// Title and intro above three tall 8-column cards.
const CONTENT_RIGHT = gridX(LAYOUT_GRID.columns) + LAYOUT_GRID.columnWidth;
const TITLE_SIZE = 82;
const TITLE_LINE_HEIGHT = 0.98;
const INTRO_WIDTH = 532;
const CARD_COLUMNS = [1, 9, 17] as const;
const CARD_WIDTH = gridWidth(8);
const CARD_Y = 355;
const CARD_HEIGHT = 596;
const CARD_PADDING = 36;
const CONTENT_WIDTH = CARD_WIDTH - CARD_PADDING * 2;
const BODY_SIZE = 17;
const BODY_LINE_HEIGHT = 1.55;
const BULLET_LINE_HEIGHT = 1.86;
const BULLET_TOP = 470;
const BULLET_DOT = 7;

const PARAGRAPHS = [
  {
    lines: 2,
    y: 270,
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  },
  {
    lines: 4,
    y: 337,
    text: "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  },
] as const;

const BULLETS = [
  "Lorem ipsum dolor sit",
  "Consectetur adipiscing",
  "Sed do eiusmod tempor",
] as const;

const CARDS = ["Lorem ipsum", "Consectetur", "Adipiscing"] as const;

// Konva drops a line that overflows the box by even a fraction.
function textHeight(lines: number, fontSize: number, lineHeight: number) {
  return Math.ceil(lines * fontSize * lineHeight) + 2;
}

function createCard(title: string, index: number): SlideElement[] {
  const id = `${ID}-card-${index + 1}`;
  const x = gridX(CARD_COLUMNS[index]);
  const contentX = x + CARD_PADDING;
  const bulletLine = BODY_SIZE * BULLET_LINE_HEIGHT;

  return [
    createLayoutShape({
      id: `${id}-background`,
      shapeType: "roundedRectangle",
      x,
      y: CARD_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      cornerRadius: 24,
      fill: WKND_COLORS.cream,
    }),
    ...createLayoutPill({
      id: `${id}-number`,
      text: String(index + 1).padStart(2, "0"),
      x: contentX,
      y: CARD_Y + 38,
      width: 53,
      height: 34,
      fontSize: 16,
      color: WKND_COLORS.muted,
    }),
    {
      ...createLayoutText({
        id: `${id}-title`,
        text: title,
        x: contentX,
        y: CARD_Y + 175,
        width: CONTENT_WIDTH,
        height: 50,
        fontSize: 41,
        fontWeight: 600,
      }),
      letterSpacing: -41 * 0.03,
    },
    createLayoutText({
      id: `${id}-subtitle`,
      text: "Sed do eiusmod tempor incididunt ut labore",
      x: contentX,
      y: CARD_Y + 229,
      width: CONTENT_WIDTH,
      height: 27,
      fontSize: 21,
      lineHeight: 1.25,
      color: WKND_COLORS.muted,
    }),
    ...PARAGRAPHS.map((paragraph, paragraphIndex) =>
      createLayoutText({
        id: `${id}-paragraph-${paragraphIndex + 1}`,
        text: paragraph.text,
        x: contentX,
        y: CARD_Y + paragraph.y,
        width: CONTENT_WIDTH,
        height: textHeight(paragraph.lines, BODY_SIZE, BODY_LINE_HEIGHT),
        fontSize: BODY_SIZE,
        lineHeight: BODY_LINE_HEIGHT,
        color: WKND_COLORS.muted,
      }),
    ),
    {
      ...createLayoutShape({
        id: `${id}-divider`,
        shapeType: "rectangle",
        x: contentX,
        y: CARD_Y + 459,
        width: CONTENT_WIDTH,
        height: 1,
        fill: WKND_COLORS.black,
      }),
      opacity: 0.15,
    },
    // One text block for the list; the dots sit on each line's centre.
    ...BULLETS.map((_, bulletIndex) =>
      createLayoutShape({
        id: `${id}-bullet-${bulletIndex + 1}`,
        shapeType: "circle",
        x: contentX + 2,
        y: Math.round(
          CARD_Y +
            BULLET_TOP +
            bulletLine * (bulletIndex + 0.5) -
            BULLET_DOT / 2,
        ),
        width: BULLET_DOT,
        height: BULLET_DOT,
        fill: WKND_COLORS.black,
      }),
    ),
    createLayoutText({
      id: `${id}-list`,
      text: BULLETS.join("\n"),
      x: contentX + 20,
      y: CARD_Y + BULLET_TOP,
      width: CONTENT_WIDTH - 20,
      height: textHeight(BULLETS.length, BODY_SIZE, BULLET_LINE_HEIGHT),
      fontSize: BODY_SIZE,
      lineHeight: BULLET_LINE_HEIGHT,
    }),
  ];
}

export const WKND_BENTO_COLUMNS_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Bento Columns",
  category: "bento",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      // Tilted star between the title and intro, tucked behind the cards.
      createRotatedLayoutObject({
        id: `${ID}-object`,
        file: "3d-stars.png",
        size: 567,
        center: { x: 1071, y: 311 },
        rotation: 12,
      }),
      ...createFrameElements(ID, "light"),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Lorem ipsum dolor sit\namet, consectetur.",
          x: gridX(1),
          y: 128,
          width: 900,
          height: textHeight(2, TITLE_SIZE, TITLE_LINE_HEIGHT),
          fontSize: TITLE_SIZE,
          fontWeight: 600,
          lineHeight: TITLE_LINE_HEIGHT,
          color: WKND_COLORS.white,
        }),
        letterSpacing: -TITLE_SIZE * 0.04,
      },
      createLayoutText({
        id: `${ID}-intro`,
        text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud.",
        x: CONTENT_RIGHT - INTRO_WIDTH - 29,
        y: 191,
        width: INTRO_WIDTH,
        height: textHeight(4, 22, 1.55),
        fontSize: 22,
        lineHeight: 1.55,
        color: WKND_COLORS.white,
        opacity: 0.85,
      }),
      ...CARDS.flatMap(createCard),
    ],
  },
};
