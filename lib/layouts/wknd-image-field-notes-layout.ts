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

const ID = "wknd-image-field-notes";
// Title, a full-width banner photo, then a heading and two text columns.
const CONTENT_RIGHT = gridX(LAYOUT_GRID.columns) + LAYOUT_GRID.columnWidth;
const TITLE_SIZE = 92;
const BANNER_Y = 340;
const BANNER_HEIGHT = 372;
const NOTES_Y = 760;
const COLUMN_WIDTH = 560;
const BODY_SIZE = 20;
const BODY_LINE_HEIGHT = 1.55;
const HEADING_SIZE = 32;
const HEADING_LINE_HEIGHT = 1.18;

function createColumnText(id: string, text: string, x: number) {
  return createLayoutText({
    id,
    text,
    x,
    y: NOTES_Y,
    width: COLUMN_WIDTH,
    // Three lines of copy; Konva drops a line that overflows the box.
    height: Math.ceil(3 * BODY_SIZE * BODY_LINE_HEIGHT) + 2,
    fontSize: BODY_SIZE,
    lineHeight: BODY_LINE_HEIGHT,
    color: WKND_COLORS.muted,
  });
}

export const WKND_IMAGE_FIELD_NOTES_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Field Notes",
  category: "image",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.cream,
    elements: [
      // W resting on the banner, its lower slab hidden behind the photo.
      createLayoutObject({
        id: `${ID}-object`,
        file: "3d-w.png",
        size: 380,
        x: 1283,
        y: 55,
      }),
      ...createFrameElements(ID),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Field Notes",
        x: gridX(1),
        y: gridY(1),
        width: 173,
        height: 50,
        fontSize: 24,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Where light meets form",
          x: gridX(1),
          y: gridY(2),
          width: gridWidth(15),
          height: Math.ceil(TITLE_SIZE * 1.1),
          fontSize: TITLE_SIZE,
          fontWeight: 600,
          lineHeight: 1.1,
        }),
        letterSpacing: -TITLE_SIZE * 0.04,
      },
      createLayoutPlaceholderImage({
        id: `${ID}-banner`,
        file: "img 1.png",
        x: gridX(1),
        y: BANNER_Y,
        width: CONTENT_RIGHT - gridX(1),
        height: BANNER_HEIGHT,
        cornerRadius: 30,
      }),
      {
        ...createLayoutText({
          id: `${ID}-heading`,
          text: "Notes from a week\nof facade studies",
          x: gridX(1),
          y: NOTES_Y + 2,
          width: gridWidth(7),
          height: Math.ceil(HEADING_SIZE * HEADING_LINE_HEIGHT * 2) + 2,
          fontSize: HEADING_SIZE,
          fontWeight: 600,
          lineHeight: HEADING_LINE_HEIGHT,
        }),
        letterSpacing: -HEADING_SIZE * 0.02,
      },
      createColumnText(
        `${ID}-note-1`,
        "Every surface records the hours it has lived through — the sun that bleached it, the rain that darkened it, the shadow that crosses it twice a day.",
        gridX(9),
      ),
      createColumnText(
        `${ID}-note-2`,
        "We collect these moments as colours, textures and angles, then turn them into a visual vocabulary for the brands we build.",
        gridX(17),
      ),
      createLayoutText({
        id: `${ID}-caption`,
        text: "Photo — Facade study, 2026",
        x: gridX(17),
        y: NOTES_Y + 107,
        width: COLUMN_WIDTH,
        height: 22,
        fontSize: 16,
        lineHeight: 1.35,
        color: WKND_COLORS.muted,
        opacity: 0.8,
      }),
    ],
  },
};
