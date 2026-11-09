import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPill,
  createLayoutPlaceholderImage,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridX } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { ImageElement } from "@/types/presentation";

const ID = "wknd-mockup-laptop-website";
// The MacBook render (1520×964) includes a site header; its hero area below
// the header spans x 182–1338 and y 158–808 of the source, and a
// placeholder photo is laid over it so the screen can be swapped.
const LAPTOP_SRC = "/assets/mockup-macbookpro/Mockup/MacBook%20Pro.png";
const LAPTOP_SOURCE = { width: 1520, height: 964 };
const LAPTOP_WIDTH = 1265;
const LAPTOP_SCALE = LAPTOP_WIDTH / LAPTOP_SOURCE.width;
const LAPTOP_X = 667;
const LAPTOP_Y = 159;
const HERO = { left: 182, top: 158, right: 1338, bottom: 808 };
const TEXT_WIDTH = 540;
const TITLE_SIZE = 62;
const BODY_SIZE = 19;
const BODY_LINE_HEIGHT = 1.62;

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

// Konva drops a line that overflows the box by even a fraction.
function textHeight(lines: number, fontSize: number, lineHeight: number) {
  return Math.ceil(lines * fontSize * lineHeight) + 2;
}

export const WKND_MOCKUP_LAPTOP_WEBSITE_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Website Launch",
  category: "macbook",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.cream,
    elements: [
      // W resting behind the laptop's lower-right corner.
      createLayoutObject({
        id: `${ID}-object`,
        file: "3d-w.png",
        size: 1000,
        x: 1200,
        y: 630,
      }),
      laptop,
      createLayoutPlaceholderImage({
        id: `${ID}-screen`,
        file: "img 2.png",
        x: Math.round(LAPTOP_X + HERO.left * LAPTOP_SCALE),
        y: Math.round(LAPTOP_Y + HERO.top * LAPTOP_SCALE),
        width: Math.round((HERO.right - HERO.left) * LAPTOP_SCALE),
        height: Math.round((HERO.bottom - HERO.top) * LAPTOP_SCALE),
        cornerRadius: 0,
      }),
      ...createFrameElements(ID),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Website",
        x: gridX(1),
        y: 239,
        width: 129,
        height: 48,
        fontSize: 22,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "A website that\nfeels like the\nbrand.",
          x: gridX(1),
          y: 310,
          width: TEXT_WIDTH,
          height: textHeight(3, TITLE_SIZE, 1),
          fontSize: TITLE_SIZE,
          fontWeight: 600,
          lineHeight: 1,
        }),
        letterSpacing: -TITLE_SIZE * 0.04,
      },
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "WKND.com redesign · launched October 2026",
        x: gridX(1),
        y: 520,
        width: TEXT_WIDTH,
        height: textHeight(2, 27, 1.37),
        fontSize: 27,
        lineHeight: 1.37,
      }),
      createLayoutText({
        id: `${ID}-body`,
        text: "The new WKND website brings our brand system to life on every screen. Built on a flexible 12–column grid, each page balances bold typography with generous white space, so case studies, services and stories can breathe. Interactive 3D objects respond to scroll and cursor movement, turning a simple visit into a playful, memorable experience — while strict performance budgets keep every page loading in under two seconds.",
        x: gridX(1),
        y: 617,
        width: TEXT_WIDTH,
        height: textHeight(8, BODY_SIZE, BODY_LINE_HEIGHT),
        fontSize: BODY_SIZE,
        lineHeight: BODY_LINE_HEIGHT,
        color: WKND_COLORS.muted,
      }),
    ],
  },
};
