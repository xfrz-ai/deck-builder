import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPhone,
  createLayoutPill,
  createLayoutShape,
  PHONE_MOCKUP_SOURCE,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridX } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { ShapeElement, SlideElement } from "@/types/presentation";

const ID = "wknd-mockup-phone-regression";
// Before and after phones side by side, joined by an arrow.
const PHONE_WIDTH = 322;
const PHONE_SCALE = PHONE_WIDTH / PHONE_MOCKUP_SOURCE.width;
const PHONE_Y = 225;
const BEFORE_X = 756;
const AFTER_X = 1386;
const MARKER_SIZE = 40;
const CHECK_SIZE = 24;
const LIST_LINE_HEIGHT = 1.36;

// Regions on the 360×740 phone source, with the marker placed at each one's
// top-right corner.
const FIXES = [
  {
    text: "Header respects the safe area on notched devices",
    lines: 2,
    y: 490,
    region: { x: 13, y: 54, width: 334, height: 65 },
    marker: { x: 365, y: 56 },
  },
  {
    text: "Hero image compressed: 3.8s → 1.1s",
    lines: 1,
    y: 570,
    region: { x: 13, y: 125, width: 357, height: 305 },
    marker: { x: 365, y: 137 },
  },
  {
    text: "CTA fully visible on iPhone SE",
    lines: 1,
    y: 620,
    region: { x: 28, y: 623, width: 328, height: 67 },
    marker: { x: 352, y: 627 },
  },
] as const;

// A point on the phone source, placed on the phone at `phoneX`.
function onPhone(phoneX: number, point: { x: number; y: number }) {
  return {
    x: Math.round(phoneX + point.x * PHONE_SCALE),
    y: Math.round(PHONE_Y + point.y * PHONE_SCALE),
  };
}

// A filled circle with a white ring and a centred glyph.
function createDot(
  id: string,
  glyph: string,
  fill: string,
  center: { x: number; y: number },
): SlideElement[] {
  const x = center.x - MARKER_SIZE / 2;
  const y = center.y - MARKER_SIZE / 2;

  return [
    createLayoutShape({
      id: `${id}-circle`,
      shapeType: "circle",
      x,
      y,
      width: MARKER_SIZE,
      height: MARKER_SIZE,
      fill,
      stroke: WKND_COLORS.white,
      strokeWidth: 3,
    }),
    createLayoutText({
      id: `${id}-glyph`,
      text: glyph,
      x,
      y,
      width: MARKER_SIZE,
      height: MARKER_SIZE,
      fontSize: 18,
      fontWeight: 700,
      lineHeight: 1,
      align: "center",
      verticalAlign: "middle",
      color: WKND_COLORS.white,
    }),
  ];
}

// A straight 2px stroke from `start`, `length` long, at `angle` degrees.
function createStroke(
  id: string,
  start: { x: number; y: number },
  length: number,
  angle: number,
): ShapeElement {
  return {
    ...createLayoutShape({
      id,
      shapeType: "rectangle",
      ...start,
      width: length,
      height: 0,
      fill: "transparent",
      stroke: WKND_COLORS.black,
      strokeWidth: 2,
    }),
    rotation: angle,
  };
}

function createVersionLabel(
  id: string,
  text: string,
  x: number,
  width: number,
  fill: string,
): SlideElement[] {
  const y = 149;
  const height = 41;

  return [
    createLayoutShape({
      id: `${id}-background`,
      shapeType: "roundedRectangle",
      x,
      y,
      width,
      height,
      cornerRadius: height / 2,
      fill,
    }),
    createLayoutText({
      id: `${id}-text`,
      text,
      x,
      y,
      width,
      height,
      fontSize: 19,
      fontWeight: 600,
      align: "center",
      verticalAlign: "middle",
      color: WKND_COLORS.white,
    }),
  ];
}

function createFix(fix: (typeof FIXES)[number], index: number): SlideElement[] {
  const id = `${ID}-fix-${index + 1}`;
  const regionOrigin = onPhone(BEFORE_X, fix.region);
  const iconY = fix.y + 3;

  return [
    // Checklist item on the left.
    createLayoutShape({
      id: `${id}-check-circle`,
      shapeType: "circle",
      x: gridX(1),
      y: iconY,
      width: CHECK_SIZE,
      height: CHECK_SIZE,
      fill: "transparent",
      stroke: WKND_COLORS.black,
      strokeWidth: 1.5,
    }),
    createLayoutText({
      id: `${id}-check-glyph`,
      text: "✓",
      x: gridX(1),
      y: iconY,
      width: CHECK_SIZE,
      height: CHECK_SIZE,
      fontSize: 14,
      fontWeight: 700,
      lineHeight: 1,
      align: "center",
      verticalAlign: "middle",
    }),
    createLayoutText({
      id: `${id}-text`,
      text: fix.text,
      x: gridX(1) + 38,
      y: fix.y,
      width: 450,
      // Konva drops a line that overflows the box by even a fraction.
      height: Math.ceil(fix.lines * 22 * LIST_LINE_HEIGHT) + 2,
      fontSize: 22,
      lineHeight: LIST_LINE_HEIGHT,
    }),
    // Dashed region and numbered marker on the "before" phone.
    createLayoutShape({
      id: `${id}-region`,
      shapeType: "rectangle",
      ...regionOrigin,
      width: Math.round(fix.region.width * PHONE_SCALE),
      height: Math.round(fix.region.height * PHONE_SCALE),
      fill: "transparent",
      stroke: WKND_COLORS.orange,
      strokeWidth: 2,
      dashed: true,
    }),
    ...createDot(
      `${id}-marker`,
      String(index + 1),
      WKND_COLORS.orange,
      onPhone(BEFORE_X, fix.marker),
    ),
    // The matching check on the "after" phone.
    ...createDot(
      `${id}-fixed`,
      "✓",
      WKND_COLORS.blue,
      onPhone(AFTER_X, fix.marker),
    ),
  ];
}

const ARROW_TIP = { x: 1224, y: 555 };

export const WKND_MOCKUP_PHONE_REGRESSION_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Regression Check",
  category: "iphone",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.yellow,
    elements: [
      // Paper-plane arrow flying off the top-right corner.
      createLayoutObject({
        id: `${ID}-object`,
        file: "3d-arrow.png",
        size: 165,
        x: 1757,
        y: 109,
      }),
      createLayoutPhone({
        id: `${ID}-before-phone`,
        x: BEFORE_X,
        y: PHONE_Y,
        width: PHONE_WIDTH,
      }),
      createLayoutPhone({
        id: `${ID}-after-phone`,
        x: AFTER_X,
        y: PHONE_Y,
        width: PHONE_WIDTH,
      }),
      ...createFrameElements(ID),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Regression",
        x: gridX(1),
        y: 108,
        width: 155,
        height: 46,
        fontSize: 22,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Fixed in v2.4.1.",
          x: gridX(1),
          y: 173,
          width: 640,
          height: 82,
          fontSize: 74,
          fontWeight: 600,
          lineHeight: 1.1,
        }),
        letterSpacing: -74 * 0.04,
      },
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "Three issues from Sprint 12 verified on device after the fix build.",
        x: gridX(1),
        y: 275,
        width: 480,
        height: Math.ceil(2 * 22 * 1.5) + 2,
        fontSize: 22,
        lineHeight: 1.5,
        color: WKND_COLORS.muted,
      }),
      ...createVersionLabel(
        `${ID}-before-label`,
        "Before · v2.4.0",
        BEFORE_X,
        189,
        WKND_COLORS.orange,
      ),
      ...createVersionLabel(
        `${ID}-after-label`,
        "After · v2.4.1",
        AFTER_X,
        166,
        WKND_COLORS.blue,
      ),
      // Arrow from before to after: a shaft and two head strokes.
      createStroke(`${ID}-arrow-shaft`, { x: 1129, y: ARROW_TIP.y }, 95, 0),
      createStroke(`${ID}-arrow-head-top`, ARROW_TIP, 18, 220),
      createStroke(`${ID}-arrow-head-bottom`, ARROW_TIP, 18, 140),
      ...FIXES.flatMap(createFix),
    ],
  },
};
