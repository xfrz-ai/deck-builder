import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutPill,
  createLayoutShape,
  createRotatedLayoutObject,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import {
  gridWidth,
  gridX,
  gridY,
  LAYOUT_GRID,
} from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { ImageElement, SlideElement } from "@/types/presentation";

const ID = "wknd-mockup-laptop-callouts";
// The MacBook render includes its screen content and soft shadow. Its
// display spans x 182–1338 and y 62–808 of the 1520×964 source.
const LAPTOP_SRC = "/assets/mockup-macbookpro/Mockup/MacBook%20Pro.png";
const LAPTOP_SOURCE = { width: 1520, height: 964 };
const LAPTOP_WIDTH = 1100;
const LAPTOP_SCALE = LAPTOP_WIDTH / LAPTOP_SOURCE.width;
const LAPTOP_X = (1920 - LAPTOP_WIDTH) / 2;
const LAPTOP_Y = 274;
const SCREEN = {
  left: LAPTOP_X + 182 * LAPTOP_SCALE,
  right: LAPTOP_X + 1338 * LAPTOP_SCALE,
};
// Four callout cards, two each side of the laptop.
const CONTENT_RIGHT = gridX(LAYOUT_GRID.columns) + LAYOUT_GRID.columnWidth;
const CARD_WIDTH = 450;
const CARD_HEIGHT = 208;
const CARD_PADDING = 28;
const CARD_ROWS = [334, 720] as const;
// Markers sit on the screen, level with their card's centre.
const MARKER_SIZE = 46;
const MARKER_INSET = 0.18;
const BADGE_SIZE = 40;
const TAG_HEIGHT = 34;
const BODY_LINE_HEIGHT = 1.6;

const CALLOUTS = [
  { tag: "Lorem", tagWidth: 78, title: "Lorem ipsum dolor" },
  { tag: "Ipsum", tagWidth: 76, title: "Sit amet consectetur" },
  { tag: "Dolor", tagWidth: 72, title: "Adipiscing elit sed" },
  { tag: "Sit amet", tagWidth: 92, title: "Eiusmod tempor" },
] as const;

const CALLOUT_BODY =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do.";

const laptop: ImageElement = {
  id: `${ID}-laptop`,
  type: "image",
  x: LAPTOP_X,
  y: LAPTOP_Y,
  width: LAPTOP_WIDTH,
  height: Math.round(LAPTOP_SOURCE.height * LAPTOP_SCALE),
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
  src: LAPTOP_SRC,
  originalWidth: LAPTOP_SOURCE.width,
  originalHeight: LAPTOP_SOURCE.height,
  cornerRadius: 0,
  fit: "contain",
};

// A filled orange circle with a centred number.
function createNumberDot({
  id,
  number,
  ringed,
  size,
  x,
  y,
}: {
  id: string;
  number: string;
  ringed: boolean;
  size: number;
  x: number;
  y: number;
}): SlideElement[] {
  return [
    createLayoutShape({
      id: `${id}-circle`,
      shapeType: "circle",
      x,
      y,
      width: size,
      height: size,
      fill: WKND_COLORS.orange,
      stroke: WKND_COLORS.white,
      strokeWidth: ringed ? 3 : 0,
    }),
    createLayoutText({
      id: `${id}-number`,
      text: number,
      x,
      y,
      width: size,
      height: size,
      fontSize: ringed ? 18 : 16,
      fontWeight: 600,
      lineHeight: 1,
      align: "center",
      verticalAlign: "middle",
      color: WKND_COLORS.white,
    }),
  ];
}

// Callouts 1–2 sit left (top, bottom), 3–4 right.
function createCallout(
  callout: (typeof CALLOUTS)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-callout-${index + 1}`;
  const number = String(index + 1).padStart(2, "0");
  const isLeft = index < 2;
  const cardX = isLeft ? gridX(1) : CONTENT_RIGHT - CARD_WIDTH;
  const cardY = CARD_ROWS[index % 2];
  const centerY = cardY + CARD_HEIGHT / 2;
  const screenWidth = SCREEN.right - SCREEN.left;
  const markerCenterX = isLeft
    ? SCREEN.left + screenWidth * MARKER_INSET
    : SCREEN.right - screenWidth * MARKER_INSET;
  const cardEdgeX = isLeft ? cardX + CARD_WIDTH : cardX;
  const lineStart = Math.min(cardEdgeX, markerCenterX);
  const lineEnd = Math.max(cardEdgeX, markerCenterX);
  const contentX = cardX + CARD_PADDING;
  const contentWidth = CARD_WIDTH - CARD_PADDING * 2;

  return [
    // Leader line from the card edge to the marker, with a dot at the card.
    createLayoutShape({
      id: `${id}-line`,
      shapeType: "rectangle",
      x: lineStart,
      y: centerY - 1,
      width: lineEnd - lineStart,
      height: 2,
      fill: WKND_COLORS.white,
    }),
    createLayoutShape({
      id: `${id}-line-dot`,
      shapeType: "circle",
      x: cardEdgeX - 4,
      y: centerY - 4,
      width: 8,
      height: 8,
      fill: WKND_COLORS.white,
    }),
    createLayoutShape({
      id: `${id}-card`,
      shapeType: "roundedRectangle",
      x: cardX,
      y: cardY,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      cornerRadius: 24,
      fill: WKND_COLORS.cream,
    }),
    ...createNumberDot({
      id: `${id}-badge`,
      number,
      ringed: false,
      size: BADGE_SIZE,
      x: contentX,
      y: cardY + CARD_PADDING,
    }),
    ...createLayoutPill({
      id: `${id}-tag`,
      text: callout.tag,
      x: contentX + BADGE_SIZE + 12,
      y: cardY + CARD_PADDING + (BADGE_SIZE - TAG_HEIGHT) / 2,
      width: callout.tagWidth,
      height: TAG_HEIGHT,
      fontSize: 16,
    }),
    {
      ...createLayoutText({
        id: `${id}-title`,
        text: callout.title,
        x: contentX,
        y: cardY + 84,
        width: contentWidth,
        height: 34,
        fontSize: 28,
        fontWeight: 600,
      }),
      letterSpacing: -0.56,
    },
    createLayoutText({
      id: `${id}-body`,
      text: CALLOUT_BODY,
      x: contentX,
      y: cardY + 126,
      width: contentWidth,
      // Konva drops a line that overflows the box by even a fraction.
      height: Math.ceil(2 * 17 * BODY_LINE_HEIGHT) + 2,
      fontSize: 17,
      lineHeight: BODY_LINE_HEIGHT,
      color: WKND_COLORS.muted,
    }),
    ...createNumberDot({
      id: `${id}-marker`,
      number,
      ringed: true,
      size: MARKER_SIZE,
      x: markerCenterX - MARKER_SIZE / 2,
      y: centerY - MARKER_SIZE / 2,
    }),
  ];
}

export const WKND_MOCKUP_LAPTOP_CALLOUTS_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Laptop Callouts",
  category: "mockup",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      // Large tilted star behind the laptop; its arms reach out between
      // the cards and off the bottom edge.
      createRotatedLayoutObject({
        id: `${ID}-object`,
        file: "3d-stars.png",
        size: 1100,
        center: { x: 966, y: 590 },
        rotation: 12,
      }),
      laptop,
      ...createFrameElements(ID, "light"),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Lorem ipsum dolor sit.",
          x: gridX(1),
          y: gridY(1),
          width: gridWidth(12),
          height: 80,
          fontSize: 72,
          fontWeight: 600,
          lineHeight: 1.1,
          color: WKND_COLORS.white,
        }),
        letterSpacing: -72 * 0.04,
      },
      createLayoutText({
        id: `${ID}-intro`,
        text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        x: CONTENT_RIGHT - 600,
        y: 104,
        width: 600,
        height: Math.ceil(3 * 21 * 1.55) + 2,
        fontSize: 21,
        lineHeight: 1.55,
        color: WKND_COLORS.white,
        opacity: 0.85,
      }),
      ...CALLOUTS.flatMap(createCallout),
    ],
  },
};
