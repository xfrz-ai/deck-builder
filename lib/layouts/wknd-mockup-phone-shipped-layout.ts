import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPhone,
  createLayoutPill,
  createLayoutShape,
  getRotatedOrigin,
  PHONE_MOCKUP_SOURCE,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridX, LAYOUT_GRID } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-mockup-phone-shipped";
// Two tilted phones over a large W on the left; story and metrics right.
const CONTENT_RIGHT = gridX(LAYOUT_GRID.columns) + LAYOUT_GRID.columnWidth;
const TEXT_X = 1162;
const TITLE_SIZE = 80;
const TITLE_LINE_HEIGHT = 1.04;
const ROW_TOP = 641;
const ROW_HEIGHT = 62;
const VALUE_GAP = 15;

// Widths are the measured text widths, used to line the parts up from the
// right edge: old value (24px), arrow (20px), new value (36px).
const ARROW_WIDTH = 20;
const METRICS = [
  {
    label: "Checkout steps",
    before: "7",
    beforeWidth: 13,
    after: "1",
    afterWidth: 14,
  },
  {
    label: "Median time to pay",
    before: "2m 40s",
    beforeWidth: 85,
    after: "48s",
    afterWidth: 63,
  },
  {
    label: "Checkout conversion (beta)",
    before: "41%",
    beforeWidth: 48,
    after: "49%",
    afterWidth: 80,
  },
] as const;

const PHONES = [
  {
    key: "before",
    label: "Before · v2.3",
    labelBox: { x: 109, y: 141, width: 148 },
    fill: WKND_COLORS.orange,
    width: 320,
    center: { x: 300, y: 545 },
    rotation: -7,
  },
  {
    key: "after",
    label: "After · v2.4",
    labelBox: { x: 581, y: 87, width: 134 },
    fill: WKND_COLORS.blue,
    width: 345,
    center: { x: 677, y: 555 },
    rotation: 6,
  },
] as const;

function createPhone(phone: (typeof PHONES)[number]): SlideElement[] {
  const height = Math.round(
    (phone.width * PHONE_MOCKUP_SOURCE.height) / PHONE_MOCKUP_SOURCE.width,
  );
  const labelHeight = 37;

  return [
    createLayoutPhone({
      id: `${ID}-${phone.key}-phone`,
      width: phone.width,
      rotation: phone.rotation,
      ...getRotatedOrigin({
        center: phone.center,
        width: phone.width,
        height,
        rotation: phone.rotation,
      }),
    }),
    createLayoutShape({
      id: `${ID}-${phone.key}-label-background`,
      shapeType: "roundedRectangle",
      ...phone.labelBox,
      height: labelHeight,
      cornerRadius: labelHeight / 2,
      fill: phone.fill,
    }),
    createLayoutText({
      id: `${ID}-${phone.key}-label`,
      text: phone.label,
      ...phone.labelBox,
      height: labelHeight,
      fontSize: 17,
      fontWeight: 600,
      align: "center",
      verticalAlign: "middle",
      color: WKND_COLORS.white,
    }),
  ];
}

function createMetric(
  metric: (typeof METRICS)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-metric-${index + 1}`;
  const top = ROW_TOP + index * ROW_HEIGHT;
  const centerY = top + ROW_HEIGHT / 2;
  const afterLeft = CONTENT_RIGHT - metric.afterWidth;
  const arrowRight = afterLeft - VALUE_GAP;
  const beforeRight = arrowRight - ARROW_WIDTH - VALUE_GAP;
  // Right-aligned boxes, so only their right edge matters.
  const boxWidth = 140;

  return [
    {
      ...createLayoutShape({
        id: `${id}-divider`,
        shapeType: "rectangle",
        x: TEXT_X,
        y: top,
        width: CONTENT_RIGHT - TEXT_X,
        height: 1,
        fill: WKND_COLORS.black,
      }),
      opacity: 0.15,
    },
    createLayoutText({
      id: `${id}-label`,
      text: metric.label,
      x: TEXT_X,
      y: centerY - 14,
      width: 360,
      height: 28,
      fontSize: 20,
      verticalAlign: "middle",
      color: WKND_COLORS.muted,
    }),
    createLayoutText({
      id: `${id}-before`,
      text: metric.before,
      x: beforeRight - boxWidth,
      y: centerY - 16,
      width: boxWidth,
      height: 32,
      fontSize: 24,
      align: "right",
      verticalAlign: "middle",
      color: WKND_COLORS.muted,
      opacity: 0.6,
    }),
    // Strikethrough for the old value; text has no strikethrough style.
    {
      ...createLayoutShape({
        id: `${id}-before-strike`,
        shapeType: "rectangle",
        x: beforeRight - metric.beforeWidth,
        y: centerY,
        width: metric.beforeWidth,
        height: 1.5,
        fill: WKND_COLORS.muted,
      }),
      opacity: 0.6,
    },
    createLayoutText({
      id: `${id}-arrow`,
      text: "→",
      x: arrowRight - boxWidth,
      y: centerY - 14,
      width: boxWidth,
      height: 28,
      fontSize: 20,
      align: "right",
      verticalAlign: "middle",
      color: WKND_COLORS.muted,
    }),
    {
      ...createLayoutText({
        id: `${id}-after`,
        text: metric.after,
        x: CONTENT_RIGHT - boxWidth,
        y: centerY - 22,
        width: boxWidth,
        height: 44,
        fontSize: 36,
        fontWeight: 600,
        align: "right",
        verticalAlign: "middle",
      }),
      letterSpacing: -36 * 0.02,
    },
  ];
}

export const WKND_MOCKUP_PHONE_SHIPPED_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Shipped Metrics",
  category: "iphone",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.cream,
    elements: [
      // Oversized W cropped by the left and bottom edges, behind the phones.
      createLayoutObject({
        id: `${ID}-object`,
        file: "3d-w.png",
        size: 1040,
        x: -245,
        y: 414,
      }),
      ...PHONES.flatMap(createPhone),
      ...createFrameElements(ID),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Shipped",
        x: TEXT_X,
        y: 278,
        width: 129,
        height: 45,
        fontSize: 20,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "From seven steps\nto one.",
          x: TEXT_X,
          y: 347,
          width: CONTENT_RIGHT - TEXT_X,
          height: Math.ceil(2 * TITLE_SIZE * TITLE_LINE_HEIGHT) + 2,
          fontSize: TITLE_SIZE,
          fontWeight: 600,
          lineHeight: TITLE_LINE_HEIGHT,
        }),
        letterSpacing: -TITLE_SIZE * 0.04,
      },
      createLayoutText({
        id: `${ID}-body`,
        text: "The new one-page checkout went live for 100% of iOS users on day 8 — two days ahead of plan.",
        x: TEXT_X,
        y: 535,
        width: CONTENT_RIGHT - TEXT_X,
        height: Math.ceil(2 * 22 * 1.45) + 2,
        fontSize: 22,
        lineHeight: 1.45,
        color: WKND_COLORS.muted,
      }),
      ...METRICS.flatMap(createMetric),
    ],
  },
};
