import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPill,
  createLayoutPlaceholderImage,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import {
  gridWidth,
  gridX,
  gridY,
  LAYOUT_GRID,
} from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-image-two-studies";
// Two half-width captioned photos from row 4.
const CONTENT_RIGHT = gridX(LAYOUT_GRID.columns) + LAYOUT_GRID.columnWidth;
const CARD_GAP = LAYOUT_GRID.gutter;
const CARD_WIDTH = (CONTENT_RIGHT - gridX(1) - CARD_GAP) / 2;
const CARD_Y = gridY(4);
const CARD_HEIGHT = 400;
const CAPTION_TITLE_Y = CARD_Y + CARD_HEIGHT + 35;
const CAPTION_BODY_Y = CAPTION_TITLE_Y + 50;
const TITLE_SIZE = 72;
const INTRO_WIDTH = 600;
const BODY_LINE_HEIGHT = 1.6;

const STUDIES = [
  {
    title: "Sunlit terracotta",
    image: "img 2.png",
    body: "The bold side of the brand. High contrast, warm and confident — used for campaigns, launches and anything that needs to be noticed from across a room.",
  },
  {
    title: "Shaded plaster",
    image: "img 4.png",
    body: "The calm side of the brand. Soft texture and low contrast — used for product pages, documentation and long reading, where the content should lead.",
  },
] as const;

function createStudy(
  study: (typeof STUDIES)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-study-${index + 1}`;
  const x = gridX(1) + index * (CARD_WIDTH + CARD_GAP);

  return [
    createLayoutPlaceholderImage({
      id: `${id}-image`,
      file: study.image,
      x,
      y: CARD_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      cornerRadius: 24,
    }),
    createLayoutText({
      id: `${id}-title`,
      text: `${String(index + 1).padStart(2, "0")} ${study.title}`,
      x,
      y: CAPTION_TITLE_Y,
      width: CARD_WIDTH,
      height: 36,
      fontSize: 30,
      fontWeight: 500,
      color: WKND_COLORS.white,
    }),
    createLayoutText({
      id: `${id}-body`,
      text: study.body,
      x,
      y: CAPTION_BODY_Y,
      width: CARD_WIDTH,
      // Two lines of copy plus one spare, since Konva drops overflowing lines.
      height: Math.ceil(3 * 20 * BODY_LINE_HEIGHT) + 2,
      fontSize: 20,
      lineHeight: BODY_LINE_HEIGHT,
      color: WKND_COLORS.white,
      opacity: 0.75,
    }),
  ];
}

export const WKND_IMAGE_TWO_STUDIES_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Two Studies",
  category: "image",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      // Arrow pointing up-right, its lower tip hidden behind the photos.
      createLayoutObject({
        id: `${ID}-object`,
        file: "3d-arrow.png",
        size: 412,
        x: 852,
        y: 96,
      }),
      ...createFrameElements(ID, "light"),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Two Studies",
        x: gridX(1),
        y: gridY(1),
        width: 181,
        height: 50,
        fontSize: 24,
        color: WKND_COLORS.white,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Two walls, one palette",
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
      createLayoutText({
        id: `${ID}-intro`,
        text: "Both photos were taken on the same street, ten minutes apart. Together they show the range the brand has to cover — from bold and sunlit to soft and shaded.",
        x: CONTENT_RIGHT - INTRO_WIDTH,
        y: 160,
        width: INTRO_WIDTH,
        height: Math.ceil(3 * 20 * 1.6) + 2,
        fontSize: 20,
        lineHeight: 1.6,
        color: WKND_COLORS.white,
        opacity: 0.85,
      }),
      ...STUDIES.flatMap(createStudy),
    ],
  },
};
