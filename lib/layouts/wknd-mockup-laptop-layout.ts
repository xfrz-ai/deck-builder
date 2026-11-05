import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPill,
  createLayoutShape,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridX } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { ImageElement } from "@/types/presentation";

const ID = "wknd-mockup-laptop";
// The MacBook render includes its screen content and soft shadow.
const LAPTOP_SRC = "/assets/mockup-macbookpro/Mockup/MacBook%20Pro.png";
const LAPTOP_SOURCE = { width: 1520, height: 964 };
const LAPTOP_WIDTH = 1540;
const STAR_SIZE = 900;
const STAR_ROTATION = 20;
const STAR_CENTER = { x: 1820, y: 140 };
// The text card overlaps the laptop's left edge.
const CARD_X = gridX(1);
const CARD_Y = 380;
const CARD_WIDTH = 616;
const CARD_HEIGHT = 524;
const CARD_PADDING = 44;
const CONTENT_X = CARD_X + CARD_PADDING;
const CONTENT_WIDTH = CARD_WIDTH - CARD_PADDING * 2;

const laptop: ImageElement = {
  id: `${ID}-laptop`,
  type: "image",
  x: 322,
  y: 48,
  width: LAPTOP_WIDTH,
  height: Math.round(
    (LAPTOP_WIDTH * LAPTOP_SOURCE.height) / LAPTOP_SOURCE.width,
  ),
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

// Rotation pivots on the top-left corner, so offset it to turn the star
// about its centre.
function createStar(): ImageElement {
  const angle = (STAR_ROTATION * Math.PI) / 180;
  const half = STAR_SIZE / 2;

  return {
    ...createLayoutObject({
      id: `${ID}-object`,
      file: "3d-stars.png",
      size: STAR_SIZE,
      x: Math.round(
        STAR_CENTER.x - half * Math.cos(angle) + half * Math.sin(angle),
      ),
      y: Math.round(
        STAR_CENTER.y - half * Math.sin(angle) - half * Math.cos(angle),
      ),
    }),
    rotation: STAR_ROTATION,
  };
}

export const WKND_MOCKUP_LAPTOP_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Laptop Showcase",
  category: "mockup",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      // Cropped by the top-right corner, behind the laptop.
      createStar(),
      laptop,
      ...createFrameElements(ID, "light"),
      createLayoutShape({
        id: `${ID}-card`,
        shapeType: "roundedRectangle",
        x: CARD_X,
        y: CARD_Y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        cornerRadius: 24,
        fill: WKND_COLORS.cream,
      }),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Built for big screens",
        x: CONTENT_X,
        y: CARD_Y + 40,
        width: 240,
        height: 46,
        fontSize: 21,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Case studies,\nupgraded.",
          x: CONTENT_X,
          y: CARD_Y + 110,
          width: CONTENT_WIDTH,
          height: 112,
          fontSize: 54,
          fontWeight: 600,
          lineHeight: 1,
        }),
        letterSpacing: -2,
      },
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "Desktop-first layouts for long-form\nstories.",
        x: CONTENT_X,
        y: CARD_Y + 242,
        width: CONTENT_WIDTH,
        height: 72,
        fontSize: 27,
        lineHeight: 1.33,
      }),
      createLayoutText({
        id: `${ID}-body`,
        text: "Designed desktop-first for the people who hire us: marketing leads reviewing work on a laptop between meetings. Large imagery, clear hierarchy and a sticky contact button make it easy to scan a case study in under a minute and reach out in one click.",
        x: CONTENT_X,
        y: CARD_Y + 334,
        width: CONTENT_WIDTH,
        height: 152,
        fontSize: 20,
        lineHeight: 1.5,
        color: WKND_COLORS.muted,
      }),
    ],
  },
};
