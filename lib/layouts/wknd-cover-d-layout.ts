import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPill,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridWidth, gridX } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";

const ID = "wknd-cover-d";
const PILL_WIDTH = 276;

export const WKND_COVER_D_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Cover D",
  category: "cover",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.orange,
    darkMode: true,
    elements: [
      // Fills the right side and bleeds off the top, right and bottom edges.
      createLayoutObject({
        id: `${ID}-object-d`,
        file: "3d-d.png",
        size: 1292,
        x: 898,
        y: -64,
      }),
      ...createFrameElements(ID, "light"),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Brand Assets — 2026",
        x: gridX(1),
        y: 240,
        width: PILL_WIDTH,
        height: 52,
        fontSize: 24,
        color: WKND_COLORS.white,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Weekend\nInc.",
          x: gridX(1),
          y: 320,
          width: gridWidth(14),
          height: 360,
          fontSize: 178,
          fontWeight: 600,
          lineHeight: 0.98,
          color: WKND_COLORS.white,
        }),
        letterSpacing: -6,
      },
      // Points back at "Inc." from the end of the second line.
      createLayoutObject({
        id: `${ID}-object-arrow`,
        file: "3d-arrow.png",
        size: 186,
        x: 470,
        y: 496,
      }),
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "Creative digital experience for\nambitious brands",
        x: gridX(1),
        y: 704,
        width: gridWidth(8),
        height: 88,
        fontSize: 32,
        lineHeight: 1.25,
        color: WKND_COLORS.white,
      }),
    ],
  },
};
