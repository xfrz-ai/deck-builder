import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPill,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import {
  gridWidth,
  gridX,
  gridY,
  LAYOUT_GRID,
} from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";

const ID = "wknd-cover-brand";
const PILL_WIDTH = 276;
const W_SIZE = 1504;

export const WKND_COVER_BRAND_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Cover Brand",
  category: "cover",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      // Placed before the frame so the footer reads over it.
      // Only the top slab rises above the bottom edge.
      createLayoutObject({
        id: `${ID}-object`,
        file: "3d-w.png",
        size: W_SIZE,
        x: (1920 - W_SIZE) / 2,
        y: 576,
      }),
      ...createFrameElements(ID, "light"),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Brand Assets — 2026",
        x: (1920 - PILL_WIDTH) / 2,
        y: gridY(1) + LAYOUT_GRID.gutter,
        width: PILL_WIDTH,
        height: 52,
        fontSize: 24,
        color: WKND_COLORS.white,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Weekend Inc.",
          x: gridX(1),
          y: 232,
          width: gridWidth(LAYOUT_GRID.columns),
          height: 228,
          fontSize: 228,
          fontWeight: 600,
          lineHeight: 1,
          align: "center",
          color: WKND_COLORS.white,
        }),
        letterSpacing: -9,
      },
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "Creative digital experience for ambitious brands",
        x: gridX(1),
        y: 496,
        width: gridWidth(LAYOUT_GRID.columns),
        height: 52,
        fontSize: 40,
        align: "center",
        color: WKND_COLORS.white,
      }),
    ],
  },
};
