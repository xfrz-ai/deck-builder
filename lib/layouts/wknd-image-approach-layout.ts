import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPlaceholderImage,
  createLayoutShape,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridWidth, gridX } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import {
  PRESENTATION_HEIGHT,
  PRESENTATION_WIDTH,
  type SlideElement,
} from "@/types/presentation";

const ID = "wknd-image-approach";
// Full-bleed photo; title on top, then three 8-column cards.
const TITLE_SIZE = 132;
const CARD_COLUMNS = [1, 9, 17] as const;
const CARD_WIDTH = gridWidth(8);
const CARD_Y = 516;
const CARD_HEIGHT = 400;
const CARD_PADDING = 44;
const ICON_SIZE = 120;
const OBJECT_SIZE = 96;
const STATEMENT_SIZE = 40;
const STATEMENT_LINE_HEIGHT = 1.3;
// Room for three lines; bottom-aligned so a longer statement grows upward
// instead of being clipped.
const STATEMENT_HEIGHT =
  Math.ceil(3 * STATEMENT_SIZE * STATEMENT_LINE_HEIGHT) + 2;
const STATEMENT_BOTTOM = CARD_Y + 362;

const POINTS = [
  { file: "3d-stars.png", text: "Turns raw spaces into clear brand stories" },
  { file: "3d-n-blue.png", text: "Helps teams make bolder design decisions" },
  { file: "3d-w.png", text: "Ships work that scales across every touchpoint" },
] as const;

function createPoint(
  point: (typeof POINTS)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-point-${index + 1}`;
  const x = gridX(CARD_COLUMNS[index]);
  const iconX = x + CARD_PADDING;
  const iconY = CARD_Y + CARD_PADDING;

  return [
    createLayoutShape({
      id: `${id}-card`,
      shapeType: "roundedRectangle",
      x,
      y: CARD_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      cornerRadius: 24,
      fill: WKND_COLORS.cream,
    }),
    // Small 3D object on a white disc.
    createLayoutShape({
      id: `${id}-icon`,
      shapeType: "circle",
      x: iconX,
      y: iconY,
      width: ICON_SIZE,
      height: ICON_SIZE,
      fill: WKND_COLORS.white,
    }),
    createLayoutObject({
      id: `${id}-object`,
      file: point.file,
      size: OBJECT_SIZE,
      x: iconX + (ICON_SIZE - OBJECT_SIZE) / 2,
      y: iconY + (ICON_SIZE - OBJECT_SIZE) / 2,
    }),
    {
      ...createLayoutText({
        id: `${id}-text`,
        text: point.text,
        x: x + CARD_PADDING,
        y: STATEMENT_BOTTOM - STATEMENT_HEIGHT,
        width: CARD_WIDTH - CARD_PADDING * 2,
        height: STATEMENT_HEIGHT,
        fontSize: STATEMENT_SIZE,
        lineHeight: STATEMENT_LINE_HEIGHT,
        verticalAlign: "bottom",
      }),
      letterSpacing: -0.4,
    },
  ];
}

export const WKND_IMAGE_APPROACH_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Our Approach",
  category: "image",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.black,
    darkMode: true,
    elements: [
      createLayoutPlaceholderImage({
        id: `${ID}-background`,
        file: "img 4.png",
        x: 0,
        y: 0,
        width: PRESENTATION_WIDTH,
        height: PRESENTATION_HEIGHT,
        cornerRadius: 0,
      }),
      // Light shade so the white title and footer stay readable on the
      // bright parts of the photo.
      {
        ...createLayoutShape({
          id: `${ID}-shade`,
          shapeType: "rectangle",
          x: 0,
          y: 0,
          width: PRESENTATION_WIDTH,
          height: PRESENTATION_HEIGHT,
          fill: WKND_COLORS.black,
        }),
        opacity: 0.18,
      },
      ...createFrameElements(ID, "light"),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Our approach:",
          x: gridX(1),
          y: 164,
          width: gridWidth(16),
          height: TITLE_SIZE,
          fontSize: TITLE_SIZE,
          fontWeight: 600,
          lineHeight: 1,
          color: WKND_COLORS.white,
        }),
        letterSpacing: -TITLE_SIZE * 0.04,
      },
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "Weekend is a brand & design studio that:",
        x: gridX(1),
        y: 330,
        width: gridWidth(14),
        height: 48,
        fontSize: 40,
        color: WKND_COLORS.white,
      }),
      ...POINTS.flatMap(createPoint),
    ],
  },
};
