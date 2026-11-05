import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutPill,
  createLayoutPlaceholderImage,
  createLayoutShape,
  createRotatedLayoutObject,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { createLayoutText } from "@/lib/layouts/layout-text";
import { PRESENTATION_HEIGHT, PRESENTATION_WIDTH } from "@/types/presentation";

const ID = "wknd-image-chapter";
// Full-bleed photo with a centred cream card on top.
const CENTER_X = PRESENTATION_WIDTH / 2;
const CARD_WIDTH = 1088;
const CARD_HEIGHT = 600;
const CARD_Y = (PRESENTATION_HEIGHT - CARD_HEIGHT) / 2;
const PILL_WIDTH = 168;
const TITLE_SIZE = 88;
const TITLE_LINE_HEIGHT = 0.98;
const BODY_WIDTH = 920;
const BODY_LINE_HEIGHT = 1.52;

// Centred text box of `width` around the slide's vertical axis.
function createCenteredText(
  options: Omit<Parameters<typeof createLayoutText>[0], "align" | "x">,
) {
  return createLayoutText({
    ...options,
    x: CENTER_X - options.width / 2,
    align: "center",
  });
}

export const WKND_IMAGE_CHAPTER_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Chapter Photo",
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
      // Tilted star tucked behind the card's top-left corner.
      createRotatedLayoutObject({
        id: `${ID}-object`,
        file: "3d-stars.png",
        size: 490,
        center: { x: 434, y: 259 },
        rotation: 19,
      }),
      ...createFrameElements(ID, "light"),
      createLayoutShape({
        id: `${ID}-card`,
        shapeType: "roundedRectangle",
        x: CENTER_X - CARD_WIDTH / 2,
        y: CARD_Y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        cornerRadius: 32,
        fill: WKND_COLORS.cream,
      }),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Chapter 01",
        x: CENTER_X - PILL_WIDTH / 2,
        y: CARD_Y + 68,
        width: PILL_WIDTH,
        height: 50,
        fontSize: 24,
      }),
      {
        ...createCenteredText({
          id: `${ID}-title`,
          text: "Designing spaces\nthat speak.",
          y: CARD_Y + 138,
          width: CARD_WIDTH - 96,
          height: Math.ceil(TITLE_SIZE * TITLE_LINE_HEIGHT * 2) + 2,
          fontSize: TITLE_SIZE,
          fontWeight: 600,
          lineHeight: TITLE_LINE_HEIGHT,
        }),
        letterSpacing: -TITLE_SIZE * 0.04,
      },
      createCenteredText({
        id: `${ID}-subtitle`,
        text: "A study in light, shadow and honest materials",
        y: CARD_Y + 342,
        width: CARD_WIDTH - 96,
        height: 34,
        fontSize: 28,
        fontWeight: 500,
      }),
      createCenteredText({
        id: `${ID}-body`,
        text: "Bold forms, warm surfaces and honest materials. We look for the moments where light and shadow turn architecture into emotion — and bring that feeling into every brand we build.",
        y: CARD_Y + 398,
        width: BODY_WIDTH,
        // Konva drops a line that overflows the box by even a fraction.
        height: Math.ceil(3 * 22 * BODY_LINE_HEIGHT) + 2,
        fontSize: 22,
        lineHeight: BODY_LINE_HEIGHT,
        color: WKND_COLORS.muted,
      }),
      createCenteredText({
        id: `${ID}-caption`,
        text: "Photo — Facade study, 2026",
        y: CARD_Y + 522,
        width: 400,
        height: 22,
        fontSize: 16,
        lineHeight: 1.35,
        color: WKND_COLORS.muted,
        opacity: 0.8,
      }),
    ],
  },
};
