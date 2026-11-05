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
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-image-materials";
// Copy on the left; a 2×2 grid of captioned images from column 10 to the
// right content edge.
const TEXT_WIDTH = 620;
const GRID_X = gridX(10);
const GRID_RIGHT = gridX(LAYOUT_GRID.columns) + LAYOUT_GRID.columnWidth;
const GRID_GAP = 24;
const CARD_WIDTH = (GRID_RIGHT - GRID_X - GRID_GAP) / 2;
const CARD_HEIGHT = 304;
const CARD_ROWS = [gridY(1), 540] as const;
const CARD_RADIUS = 20;
const TITLE_SIZE = 80;
const TITLE_LINE_HEIGHT = 0.96;
const BODY_SIZE = 19;
const BODY_LINE_HEIGHT = 1.55;
const BODY_LINE = BODY_SIZE * BODY_LINE_HEIGHT;

const PARAGRAPHS = [
  {
    lines: 3,
    y: 428,
    text: "Before we picked a single colour, we walked the city with a camera. These four surfaces became the reference for every tone, grain and gradient in the system.",
  },
  {
    lines: 2,
    y: 536,
    text: "Each texture has a job: one leads, one supports, one gives air and one adds surprise.",
  },
] as const;

const MATERIALS = [
  {
    title: "Terracotta",
    image: "img 2.png",
    body: "The warm anchor of the palette, used for every hero moment.",
  },
  {
    title: "Plaster",
    image: "img 4.png",
    body: "A soft, tactile neutral that carries long-form content.",
  },
  {
    title: "Sky",
    image: "img 3.png",
    body: "Gives the layout air and balances the warm tones.",
  },
  {
    title: "Coral",
    image: "img 1.png",
    body: "A playful accent for social and small surprises.",
  },
] as const;

function createMaterial(
  material: (typeof MATERIALS)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-material-${index + 1}`;
  const x = GRID_X + (index % 2) * (CARD_WIDTH + GRID_GAP);
  const y = CARD_ROWS[Math.floor(index / 2)];

  return [
    createLayoutPlaceholderImage({
      id: `${id}-image`,
      file: material.image,
      x,
      y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      cornerRadius: CARD_RADIUS,
    }),
    createLayoutText({
      id: `${id}-title`,
      text: `${String(index + 1).padStart(2, "0")} ${material.title}`,
      x,
      y: y + CARD_HEIGHT + 16,
      width: CARD_WIDTH,
      height: 28,
      fontSize: 22,
      fontWeight: 500,
    }),
    createLayoutText({
      id: `${id}-body`,
      text: material.body,
      x,
      y: y + CARD_HEIGHT + 50,
      width: CARD_WIDTH,
      height: 28,
      fontSize: 17,
      lineHeight: 1.5,
      color: WKND_COLORS.muted,
    }),
  ];
}

export const WKND_IMAGE_MATERIALS_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Materials",
  category: "image",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.cream,
    elements: [
      // K tilted and cropped by the bottom edge; its quarter stops short of
      // the "03" caption.
      createRotatedLayoutObject({
        id: `${ID}-object`,
        file: "3d-k.png",
        size: 500,
        center: { x: 469, y: 992 },
        rotation: 9,
      }),
      ...createFrameElements(ID),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Materials",
        x: gridX(1),
        y: gridY(1),
        width: 147,
        height: 50,
        fontSize: 24,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "A palette\nbuilt from walls",
          x: gridX(1),
          y: 196,
          width: TEXT_WIDTH,
          height: Math.ceil(TITLE_SIZE * TITLE_LINE_HEIGHT * 2) + 2,
          fontSize: TITLE_SIZE,
          fontWeight: 600,
          lineHeight: TITLE_LINE_HEIGHT,
        }),
        letterSpacing: -TITLE_SIZE * 0.04,
      },
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "Four textures that shaped the identity",
        x: gridX(1),
        y: 374,
        width: TEXT_WIDTH,
        height: 32,
        fontSize: 26,
        fontWeight: 500,
      }),
      // Separate boxes keep the paragraph gap tighter than a blank line.
      ...PARAGRAPHS.map((paragraph, index) =>
        createLayoutText({
          id: `${ID}-paragraph-${index + 1}`,
          text: paragraph.text,
          x: gridX(1),
          y: paragraph.y,
          width: TEXT_WIDTH,
          // Konva drops a line that overflows the box by even a fraction.
          height: Math.ceil(paragraph.lines * BODY_LINE) + 2,
          fontSize: BODY_SIZE,
          lineHeight: BODY_LINE_HEIGHT,
          color: WKND_COLORS.muted,
        }),
      ),
      ...MATERIALS.flatMap(createMaterial),
    ],
  },
};
