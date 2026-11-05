import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutPill,
  createLayoutPlaceholderImage,
  createRotatedLayoutObject,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridWidth, gridX, gridY } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-image-moods";
// Four 6-column image cards from row 4, each captioned underneath.
const CARD_COLUMNS = [1, 7, 13, 19] as const;
const CARD_WIDTH = gridWidth(6);
const CARD_Y = gridY(4);
const CARD_HEIGHT = 390;
const CARD_RADIUS = 24;
const CAPTION_TITLE_Y = CARD_Y + CARD_HEIGHT + 28;
const CAPTION_BODY_Y = CAPTION_TITLE_Y + 44;
const TITLE_SIZE = 72;
const INTRO_WIDTH = 608;

const MOODS = [
  {
    title: "Warm",
    image: "img 2.png",
    body: "Sun-baked terracotta for campaigns and launches. Confident, bold and impossible to miss.",
  },
  {
    title: "Calm",
    image: "img 4.png",
    body: "Soft plaster for product pages and long reading, where the content should lead.",
  },
  {
    title: "Open",
    image: "img 3.png",
    body: "Clear sky and crisp edges for onboarding and empty states. Light, honest and optimistic.",
  },
  {
    title: "Playful",
    image: "img 1.png",
    body: "Coral and teal for social content and small moments of surprise across the product.",
  },
] as const;

function createMood(
  mood: (typeof MOODS)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-mood-${index + 1}`;
  const x = gridX(CARD_COLUMNS[index]);

  return [
    createLayoutPlaceholderImage({
      id: `${id}-image`,
      file: mood.image,
      x,
      y: CARD_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      cornerRadius: CARD_RADIUS,
    }),
    createLayoutText({
      id: `${id}-title`,
      text: `${String(index + 1).padStart(2, "0")} ${mood.title}`,
      x,
      y: CAPTION_TITLE_Y,
      width: CARD_WIDTH,
      height: 34,
      fontSize: 28,
      fontWeight: 500,
      color: WKND_COLORS.white,
    }),
    createLayoutText({
      id: `${id}-body`,
      text: mood.body,
      x,
      y: CAPTION_BODY_Y,
      width: CARD_WIDTH,
      // Konva drops a line that overflows the box by even a fraction.
      height: Math.ceil(2 * 18 * 1.55) + 2,
      fontSize: 18,
      lineHeight: 1.55,
      color: WKND_COLORS.white,
      opacity: 0.75,
    }),
  ];
}

export const WKND_IMAGE_MOODS_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Four Moods",
  category: "image",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      // Tilted star behind the cards: its arms peek out above the second
      // card and its stem shows in the gap between cards two and three.
      createRotatedLayoutObject({
        id: `${ID}-object`,
        file: "3d-stars.png",
        size: 422,
        center: { x: 969, y: 351 },
        rotation: 12,
      }),
      ...createFrameElements(ID, "light"),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Four Moods",
        x: gridX(1),
        y: gridY(1),
        width: 176,
        height: 50,
        fontSize: 24,
        color: WKND_COLORS.white,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Four walls, four moods",
          x: gridX(1),
          y: gridY(2),
          width: gridWidth(11),
          height: Math.ceil(TITLE_SIZE * 1.1),
          fontSize: TITLE_SIZE,
          fontWeight: 600,
          lineHeight: 1.1,
          color: WKND_COLORS.white,
        }),
        letterSpacing: -TITLE_SIZE * 0.04,
      },
      // Right-aligned to the content edge; wide enough that each sample line
      // matches the design.
      createLayoutText({
        id: `${ID}-intro`,
        text: "We sorted the city walk into four moods. Each one maps to a part of the brand, so designers always know which photo, colour and tone of voice to reach for.",
        x: gridX(24) + gridWidth(1) - INTRO_WIDTH,
        y: 160,
        width: INTRO_WIDTH,
        height: Math.ceil(3 * 20 * 1.6) + 2,
        fontSize: 20,
        lineHeight: 1.6,
        color: WKND_COLORS.white,
        opacity: 0.85,
      }),
      ...MOODS.flatMap(createMood),
    ],
  },
};
