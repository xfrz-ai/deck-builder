import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPill,
  createLayoutShape,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridX, LAYOUT_GRID } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { ImageElement, SlideElement } from "@/types/presentation";

const ID = "wknd-mockup-phone";
// The phone render includes its screen content.
const PHONE_SRC = "/assets/mockup-iphone/QA/Phone%20Mockup.png";
const PHONE_SOURCE = { width: 360, height: 740 };
const PHONE_WIDTH = 366;
const PHONE_Y = 154;
const W_SIZE = 165;
const W_ROTATION = -15;
// Content to the right of the phone runs from column 8 to the right margin.
const CONTENT_X = gridX(8);
const CONTENT_WIDTH =
  gridX(LAYOUT_GRID.columns) + LAYOUT_GRID.columnWidth - CONTENT_X;
const CARD_TOP = 306;
const CARD_PADDING = 32;
const HEADER_HEIGHT = 76;
const ROW_HEIGHT = 75;
const ICON_SIZE = 32;
const COLUMN_PITCH = 152;
// Device columns are centred, the last one 110px in from the card's edge.
const FIRST_COLUMN_CENTER = CONTENT_WIDTH - 110 - 4 * COLUMN_PITCH;
const DIVIDER_COLOR = "#EDE6D6";

const STATUS = {
  pass: { fill: WKND_COLORS.blue, glyph: "✓", color: WKND_COLORS.white },
  fail: { fill: WKND_COLORS.orange, glyph: "✕", color: WKND_COLORS.white },
  minor: { fill: WKND_COLORS.yellow, glyph: "!", color: WKND_COLORS.black },
} as const;

type Status = keyof typeof STATUS;

const DEVICES = ["iPhone 15", "iPhone SE", "Pixel 8", "Galaxy S24", "iPad Air"];

const TESTS: readonly { name: string; results: readonly Status[] }[] = [
  { name: "Login & OTP", results: ["pass", "pass", "pass", "pass", "pass"] },
  { name: "Checkout flow", results: ["pass", "fail", "pass", "minor", "pass"] },
  {
    name: "Push notifications",
    results: ["pass", "pass", "minor", "pass", "pass"],
  },
  { name: "Dark mode", results: ["pass", "pass", "pass", "pass", "minor"] },
  { name: "Offline mode", results: ["minor", "fail", "pass", "pass", "pass"] },
  { name: "Deep links", results: ["pass", "pass", "pass", "fail", "pass"] },
];

// Legend entries, with x offsets from the legend's left edge.
const LEGEND = [
  { status: "pass", label: "Pass", x: 20 },
  { status: "fail", label: "Fail", x: 117 },
  { status: "minor", label: "Minor issue", x: 204 },
] as const;

const phone: ImageElement = {
  id: `${ID}-phone`,
  type: "image",
  x: gridX(1) + 20,
  y: PHONE_Y,
  width: PHONE_WIDTH,
  height: Math.round((PHONE_WIDTH * PHONE_SOURCE.height) / PHONE_SOURCE.width),
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
  src: PHONE_SRC,
  originalWidth: PHONE_SOURCE.width,
  originalHeight: PHONE_SOURCE.height,
  cornerRadius: 0,
  fit: "contain",
};

// Perched on the phone's top-right corner. Rotation pivots on the top-left
// corner, so offset it to turn the object about its centre.
function createW(): ImageElement {
  const center = { x: 498, y: 170 };
  const angle = (W_ROTATION * Math.PI) / 180;
  const half = W_SIZE / 2;

  return {
    ...createLayoutObject({
      id: `${ID}-object`,
      file: "3d-w.png",
      size: W_SIZE,
      x: Math.round(center.x - half * Math.cos(angle) + half * Math.sin(angle)),
      y: Math.round(center.y - half * Math.sin(angle) - half * Math.cos(angle)),
    }),
    rotation: W_ROTATION,
  };
}

function createStatusIcon(
  id: string,
  status: Status,
  x: number,
  y: number,
  size: number,
): SlideElement[] {
  const { color, fill, glyph } = STATUS[status];

  return [
    createLayoutShape({
      id: `${id}-circle`,
      shapeType: "circle",
      x,
      y,
      width: size,
      height: size,
      fill,
    }),
    createLayoutText({
      id: `${id}-glyph`,
      text: glyph,
      x,
      y,
      width: size,
      height: size,
      fontSize: Math.round(size * 0.55),
      fontWeight: 700,
      lineHeight: 1,
      align: "center",
      verticalAlign: "middle",
      color,
    }),
  ];
}

function createLegend(): SlideElement[] {
  const top = 237;
  const height = 46;
  const iconSize = 22;

  return [
    createLayoutShape({
      id: `${ID}-legend`,
      shapeType: "roundedRectangle",
      x: CONTENT_X,
      y: top,
      width: 356,
      height,
      cornerRadius: height / 2,
      fill: WKND_COLORS.cream,
    }),
    ...LEGEND.flatMap((item) => [
      ...createStatusIcon(
        `${ID}-legend-${item.status}`,
        item.status,
        CONTENT_X + item.x,
        top + (height - iconSize) / 2,
        iconSize,
      ),
      createLayoutText({
        id: `${ID}-legend-${item.status}-label`,
        text: item.label,
        x: CONTENT_X + item.x + iconSize + 9,
        y: top,
        width: 120,
        height,
        fontSize: 19,
        verticalAlign: "middle",
        color: WKND_COLORS.muted,
      }),
    ]),
  ];
}

function columnCenter(index: number) {
  return CONTENT_X + FIRST_COLUMN_CENTER + index * COLUMN_PITCH;
}

function createMatrix(): SlideElement[] {
  const rowsTop = CARD_TOP + HEADER_HEIGHT;
  const cardHeight = HEADER_HEIGHT + TESTS.length * ROW_HEIGHT + 16;
  const rowX = CONTENT_X + CARD_PADDING;
  const rowWidth = CONTENT_WIDTH - CARD_PADDING * 2;

  return [
    createLayoutShape({
      id: `${ID}-card`,
      shapeType: "roundedRectangle",
      x: CONTENT_X,
      y: CARD_TOP,
      width: CONTENT_WIDTH,
      height: cardHeight,
      cornerRadius: 28,
      fill: WKND_COLORS.cream,
    }),
    createLayoutText({
      id: `${ID}-header-test`,
      text: "Test case",
      x: rowX,
      y: CARD_TOP,
      width: 240,
      height: HEADER_HEIGHT,
      fontSize: 18,
      verticalAlign: "middle",
      color: WKND_COLORS.muted,
    }),
    ...DEVICES.map((device, index) =>
      createLayoutText({
        id: `${ID}-header-device-${index + 1}`,
        text: device,
        x: columnCenter(index) - COLUMN_PITCH / 2,
        y: CARD_TOP,
        width: COLUMN_PITCH,
        height: HEADER_HEIGHT,
        fontSize: 18,
        align: "center",
        verticalAlign: "middle",
        color: WKND_COLORS.muted,
      }),
    ),
    ...TESTS.flatMap((test, rowIndex) => {
      const id = `${ID}-row-${rowIndex + 1}`;
      const top = rowsTop + rowIndex * ROW_HEIGHT;

      return [
        createLayoutShape({
          id: `${id}-divider`,
          shapeType: "rectangle",
          x: rowX,
          y: top,
          width: rowWidth,
          height: 1.5,
          fill: DIVIDER_COLOR,
        }),
        createLayoutText({
          id: `${id}-name`,
          text: test.name,
          x: rowX,
          y: top,
          width: 320,
          height: ROW_HEIGHT,
          fontSize: 22,
          fontWeight: 600,
          verticalAlign: "middle",
        }),
        ...test.results.flatMap((status, columnIndex) =>
          createStatusIcon(
            `${id}-result-${columnIndex + 1}`,
            status,
            columnCenter(columnIndex) - ICON_SIZE / 2,
            top + (ROW_HEIGHT - ICON_SIZE) / 2,
            ICON_SIZE,
          ),
        ),
      ];
    }),
  ];
}

export const WKND_MOCKUP_PHONE_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Device Matrix",
  category: "iphone",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.orange,
    darkMode: true,
    elements: [
      ...createFrameElements(ID, "light"),
      phone,
      createW(),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Compatibility",
        x: CONTENT_X,
        y: 84,
        width: 180,
        height: 46,
        fontSize: 22,
        color: WKND_COLORS.white,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Cross-device test matrix.",
          x: CONTENT_X,
          y: 150,
          width: CONTENT_WIDTH,
          height: 76,
          fontSize: 66,
          fontWeight: 600,
          lineHeight: 1,
          color: WKND_COLORS.white,
        }),
        letterSpacing: -3,
      },
      ...createLegend(),
      ...createMatrix(),
    ],
  },
};
