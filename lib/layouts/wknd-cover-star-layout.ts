import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createRotatedLayoutObject,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridWidth, gridX } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";

const ID = "wknd-cover-star";
const STAR_SIZE = 1620;
const STAR_ROTATION = 12;
// Where the star's centre lands; it bleeds off the top and bottom edges.
const STAR_CENTER = { x: 935, y: 640 };

export const WKND_COVER_STAR_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Cover Star",
  category: "cover",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.black,
    darkMode: true,
    elements: [
      createRotatedLayoutObject({
        id: `${ID}-object`,
        file: "3d-stars.png",
        size: STAR_SIZE,
        center: STAR_CENTER,
        rotation: STAR_ROTATION,
      }),
      ...createFrameElements(ID, "light"),
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "Creative digital experience for ambitious brands",
        x: gridX(1),
        y: 596,
        width: gridWidth(14),
        height: 48,
        fontSize: 36,
        color: WKND_COLORS.white,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Weekend Inc.",
          x: gridX(1),
          y: 660,
          width: gridWidth(22),
          height: 232,
          fontSize: 232,
          fontWeight: 600,
          lineHeight: 1,
          color: WKND_COLORS.white,
        }),
        letterSpacing: -9,
      },
    ],
  },
};
