import { gridWidth, gridX, gridY } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type {
  ImageElement,
  ShapeElement,
  SlideElement,
} from "@/types/presentation";

export const WKND_COLORS = {
  black: "#111111",
  blue: "#032ABF",
  cream: "#FFFBED",
  muted: "#555555",
  orange: "#E04E2B",
  white: "#FFFFFF",
  yellow: "#FBB03A",
} as const;

// Portrait people photos (189×235) used as placeholders in team layouts.
const PEOPLE_DIR = "/assets/img-people";
const PEOPLE_PHOTO_WIDTH = 189;
const PEOPLE_PHOTO_HEIGHT = 235;
// Square 3D brand objects, exported from Figma at 1254×1254.
export const WKND_3D_DIR = "/assets/3d-logo-wknd";
export const WKND_3D_SOURCE_SIZE = 1254;
// The QA iPhone render, with its screen content baked in.
const PHONE_MOCKUP_SRC = "/assets/mockup-iphone/QA/Phone%20Mockup.png";
export const PHONE_MOCKUP_SOURCE = { width: 360, height: 740 } as const;
// Square architecture photos used as image placeholders.
const PLACEHOLDER_DIR = "/assets/img-placeholder";
const PLACEHOLDER_SIZE = 1000;

export interface LayoutShapeOptions {
  cornerRadius?: number;
  dashed?: boolean;
  fill: string;
  height: number;
  id: string;
  shapeType: ShapeElement["shapeType"];
  stroke?: string;
  strokeWidth?: number;
  width: number;
  x: number;
  y: number;
}

export function createLayoutShape({
  cornerRadius,
  dashed,
  fill,
  height,
  id,
  shapeType,
  stroke = fill,
  strokeWidth = 0,
  width,
  x,
  y,
}: LayoutShapeOptions): ShapeElement {
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
    stroke,
    strokeWidth,
    ...(shapeType === "roundedRectangle" ? { cornerRadius } : {}),
    ...(dashed ? { dashed } : {}),
  };
}

type LayoutImageBox = Pick<ImageElement, "height" | "id" | "width" | "x" | "y">;

// A cropped people photo; `photo` is the placeholder index (0–8).
export function createLayoutPhoto({
  cornerRadius,
  photo,
  ...box
}: LayoutImageBox & { cornerRadius: number; photo: number }): ImageElement {
  return {
    ...box,
    type: "image",
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    src: `${PEOPLE_DIR}/Placeholder${photo === 0 ? "" : `-${photo}`}.png`,
    originalWidth: PEOPLE_PHOTO_WIDTH,
    originalHeight: PEOPLE_PHOTO_HEIGHT,
    cornerRadius,
    fit: "cover",
  };
}

// A placeholder photo (e.g. "img 2.png") cropped to fill its box.
export function createLayoutPlaceholderImage({
  cornerRadius,
  file,
  ...box
}: LayoutImageBox & { cornerRadius: number; file: string }): ImageElement {
  return {
    ...box,
    type: "image",
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    // The file names contain spaces.
    src: `${PLACEHOLDER_DIR}/${encodeURIComponent(file)}`,
    originalWidth: PLACEHOLDER_SIZE,
    originalHeight: PLACEHOLDER_SIZE,
    cornerRadius,
    fit: "cover",
  };
}

// The iPhone mockup at `width`, keeping its aspect ratio.
export function createLayoutPhone({
  id,
  rotation = 0,
  width,
  x,
  y,
}: Pick<ImageElement, "id" | "x" | "y"> & {
  rotation?: number;
  width: number;
}): ImageElement {
  return {
    id,
    type: "image",
    x,
    y,
    width,
    height: Math.round(
      (width * PHONE_MOCKUP_SOURCE.height) / PHONE_MOCKUP_SOURCE.width,
    ),
    rotation,
    opacity: 1,
    locked: false,
    visible: true,
    src: PHONE_MOCKUP_SRC,
    originalWidth: PHONE_MOCKUP_SOURCE.width,
    originalHeight: PHONE_MOCKUP_SOURCE.height,
    cornerRadius: 0,
    fit: "contain",
  };
}

// A square 3D brand object from the WKND set.
export function createLayoutObject({
  file,
  id,
  size,
  x,
  y,
}: Pick<ImageElement, "id" | "x" | "y"> & {
  file: string;
  size: number;
}): ImageElement {
  return {
    id,
    type: "image",
    x,
    y,
    width: size,
    height: size,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    src: `${WKND_3D_DIR}/${file}`,
    originalWidth: WKND_3D_SOURCE_SIZE,
    originalHeight: WKND_3D_SOURCE_SIZE,
    cornerRadius: 0,
    fit: "contain",
  };
}

// Top-left corner for a `width`×`height` box turned `rotation` degrees about
// `center`. Konva rotates about the top-left corner, so it is offset to keep
// the centre in place.
export function getRotatedOrigin({
  center,
  height,
  rotation,
  width,
}: {
  center: { x: number; y: number };
  height: number;
  rotation: number;
  width: number;
}) {
  const angle = (rotation * Math.PI) / 180;
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return {
    x: Math.round(
      center.x - halfWidth * Math.cos(angle) + halfHeight * Math.sin(angle),
    ),
    y: Math.round(
      center.y - halfWidth * Math.sin(angle) - halfHeight * Math.cos(angle),
    ),
  };
}

// A 3D object turned `rotation` degrees about its centre.
export function createRotatedLayoutObject({
  center,
  file,
  id,
  rotation,
  size,
}: {
  center: { x: number; y: number };
  file: string;
  id: string;
  rotation: number;
  size: number;
}): ImageElement {
  return {
    ...createLayoutObject({
      id,
      file,
      size,
      ...getRotatedOrigin({ center, width: size, height: size, rotation }),
    }),
    rotation,
  };
}

// Outlined, fully rounded label such as "Our Team" or "02 people".
export function createLayoutPill({
  color = WKND_COLORS.black,
  fontSize,
  height,
  id,
  text,
  width,
  x,
  y,
}: {
  color?: string;
  fontSize: number;
  height: number;
  id: string;
  text: string;
  width: number;
  x: number;
  y: number;
}): SlideElement[] {
  return [
    createLayoutShape({
      id: `${id}-outline`,
      shapeType: "roundedRectangle",
      x,
      y,
      width,
      height,
      cornerRadius: height / 2,
      fill: "transparent",
      stroke: color,
      strokeWidth: 2,
    }),
    createLayoutText({
      id: `${id}-label`,
      text,
      x,
      y,
      width,
      height,
      fontSize,
      align: "center",
      verticalAlign: "middle",
      color,
    }),
  ];
}

// Eyebrow pill in row 1 with the slide title (two lines by default) from
// row 2.
export function createLayoutHeader({
  color = WKND_COLORS.black,
  eyebrow,
  fontSize,
  id,
  lineHeight,
  title,
  titleLines = 2,
  titleWidth = gridWidth(8),
}: {
  color?: string;
  eyebrow: string;
  fontSize: number;
  id: string;
  lineHeight: number;
  title: string;
  titleLines?: number;
  titleWidth?: number;
}): SlideElement[] {
  return [
    ...createLayoutPill({
      id: `${id}-eyebrow`,
      text: eyebrow,
      x: gridX(1),
      y: gridY(1),
      width: 152,
      height: 48,
      fontSize: 24,
      color,
    }),
    {
      ...createLayoutText({
        id: `${id}-title`,
        text: title,
        x: gridX(1),
        y: gridY(2),
        width: titleWidth,
        height: Math.ceil(fontSize * lineHeight * titleLines),
        fontSize,
        fontWeight: 600,
        lineHeight,
        color,
      }),
      letterSpacing: -fontSize * 0.04,
    },
  ];
}
