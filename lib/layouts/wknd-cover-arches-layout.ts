import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import { resolve3dFile, WKND_3D_SOURCE_SIZE } from "@/lib/themes/deck-themes";
import { gridWidth, gridX, gridY } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type {
  ImageElement,
  ShapeElement,
  SlideElement,
} from "@/types/presentation";

const BACKGROUND = "#FBB03A";
// Each arch spans 8 columns from row 4; three of them fill the grid width.
const ARCH_WIDTH = gridWidth(8);
const ARCH_TOP = gridY(4);
// As tall as it is wide, so the full circle forming the round top ends
// exactly on the flat base instead of bulging below it. Ends at y 920,
// inside the content area.
const ARCH_HEIGHT = ARCH_WIDTH;
const ARCH_CORNER_RADIUS = 24;
const OBJECT_SIZE = 384;
// Objects sit a little below the arch centre, like the brand guide.
const OBJECT_Y = ARCH_TOP + ARCH_HEIGHT / 2 - OBJECT_SIZE / 2 + 56;

const ARCHES = [
  { key: "n", column: 1, fill: "#032ABF", src: "3d-n-white.png" },
  { key: "d", column: 9, fill: "#FFFBED", src: "3d-d.png" },
  { key: "w", column: 17, fill: "#111111", src: "3d-w.png" },
] as const;

function createShape(
  id: string,
  shapeType: ShapeElement["shapeType"],
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
): ShapeElement {
  return {
    id,
    type: "shape",
    shapeType,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    fill,
    stroke: fill,
    strokeWidth: 0,
    ...(shapeType === "roundedRectangle"
      ? { cornerRadius: ARCH_CORNER_RADIUS }
      : {}),
  };
}

function createObject(id: string, src: string, x: number): ImageElement {
  return {
    id,
    type: "image",
    x,
    y: OBJECT_Y,
    width: OBJECT_SIZE,
    height: OBJECT_SIZE,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    src: resolve3dFile(src),
    originalWidth: WKND_3D_SOURCE_SIZE,
    originalHeight: WKND_3D_SOURCE_SIZE,
    cornerRadius: 0,
    fit: "contain",
  };
}

// An arch is a full circle for the round top over a rounded rectangle for
// the lower half, with the 3D object on top.
function createArch({
  column,
  fill,
  key,
  src,
}: (typeof ARCHES)[number]): SlideElement[] {
  const id = `wknd-cover-arches-${key}`;
  const x = gridX(column);
  const radius = ARCH_WIDTH / 2;

  return [
    createShape(
      `${id}-top`,
      "circle",
      x,
      ARCH_TOP,
      ARCH_WIDTH,
      ARCH_WIDTH,
      fill,
    ),
    // Starts one corner radius above the circle's equator so the base's
    // rounded top corners hide behind the circle instead of notching the
    // sides where the two shapes meet.
    createShape(
      `${id}-base`,
      "roundedRectangle",
      x,
      ARCH_TOP + radius - ARCH_CORNER_RADIUS,
      ARCH_WIDTH,
      ARCH_HEIGHT - radius + ARCH_CORNER_RADIUS,
      fill,
    ),
    createObject(`${id}-object`, src, x + (ARCH_WIDTH - OBJECT_SIZE) / 2),
  ];
}

export const WKND_COVER_ARCHES_LAYOUT: SlideLayoutDefinition = {
  id: "wknd-cover-arches",
  name: "Cover Arches",
  category: "cover",
  slide: {
    id: "layout-wknd-cover-arches",
    background: BACKGROUND,
    elements: [
      ...createFrameElements("wknd-cover-arches"),
      {
        ...createLayoutText({
          id: "wknd-cover-arches-title",
          text: "Weekend Inc.",
          x: gridX(1),
          y: 104,
          width: gridWidth(14),
          height: 152,
          fontSize: 152,
          fontWeight: 600,
          lineHeight: 1,
        }),
        letterSpacing: -6,
      },
      createLayoutText({
        id: "wknd-cover-arches-subtitle",
        text: "Creative digital experience\nfor ambitious brands",
        x: gridX(19),
        y: 176,
        width: gridWidth(6),
        height: 72,
        fontSize: 30,
        lineHeight: 1.2,
      }),
      ...ARCHES.flatMap(createArch),
    ],
  },
};
