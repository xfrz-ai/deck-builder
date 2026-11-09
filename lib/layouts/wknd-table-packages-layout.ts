import { attachDynamicTable } from "@/lib/table/table-migration";
import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPill,
  createLayoutShape,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import {
  gridWidth,
  gridX,
  gridY,
  LAYOUT_GRID,
} from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { ImageElement, SlideElement } from "@/types/presentation";

const ID = "wknd-table-packages";
// Feature labels take columns 1–9; each package gets five columns after it.
const TABLE_X = gridX(1);
const TABLE_RIGHT = gridX(LAYOUT_GRID.columns) + LAYOUT_GRID.columnWidth;
const LABEL_WIDTH = gridWidth(9);
const PLAN_COLUMNS = [10, 15, 20] as const;
const PLAN_WIDTH = gridWidth(5);
// One row per grid pitch, starting at row 6.
const HEADER_RULE_Y = gridY(6);
const ROW_HEIGHT = LAYOUT_GRID.rowHeight + LAYOUT_GRID.gutter;
const HIGHLIGHT_TOP = gridY(4);
const HIGHLIGHT_BOTTOM_PADDING = 20;
const BADGE = { width: 196, height: 44 };
const CHECK_SIZE = 30;
const DIVIDER_COLOR = "#E4DFCF";
const STAR_SIZE = 184;
const STAR_ROTATION = 15;

type Cell = string | boolean;

const PLANS = [
  { name: "Starter", price: "from $25k", highlighted: false },
  { name: "Growth", price: "from $45k", highlighted: true },
  { name: "Premium", price: "from $80k", highlighted: false },
] as const;

// `true` renders a check, `false` a dash.
const FEATURES: readonly { label: string; values: readonly Cell[] }[] = [
  { label: "Timeline", values: ["4 weeks", "8 weeks", "12 weeks"] },
  { label: "Brand strategy", values: [false, true, true] },
  { label: "Visual identity & 3D assets", values: [true, true, true] },
  {
    label: "Website",
    values: ["Landing page", "Up to 5 pages", "Up to 15 pages"],
  },
  { label: "Revisions", values: ["2 rounds", "3 rounds", "Unlimited"] },
  { label: "Dedicated project manager", values: [false, false, true] },
];

const TABLE_BOTTOM = HEADER_RULE_Y + FEATURES.length * ROW_HEIGHT;

function planX(index: number) {
  return gridX(PLAN_COLUMNS[index]);
}

function createRule(id: string, y: number, fill = DIVIDER_COLOR) {
  return createLayoutShape({
    id,
    shapeType: "rectangle",
    x: TABLE_X,
    y,
    width: TABLE_RIGHT - TABLE_X,
    height: 1.5,
    fill,
  });
}

function createCell(
  id: string,
  value: Cell,
  x: number,
  y: number,
  color: string,
): SlideElement[] {
  if (value === true) {
    const left = x + (PLAN_WIDTH - CHECK_SIZE) / 2;
    const top = y + (ROW_HEIGHT - CHECK_SIZE) / 2;

    return [
      createLayoutShape({
        id: `${id}-check-circle`,
        shapeType: "circle",
        x: left,
        y: top,
        width: CHECK_SIZE,
        height: CHECK_SIZE,
        fill: "transparent",
        stroke: color,
        strokeWidth: 2,
      }),
      createLayoutText({
        id: `${id}-check-glyph`,
        text: "✓",
        x: left,
        y: top,
        width: CHECK_SIZE,
        height: CHECK_SIZE,
        fontSize: 17,
        fontWeight: 700,
        lineHeight: 1,
        align: "center",
        verticalAlign: "middle",
        color,
      }),
    ];
  }

  return [
    createLayoutText({
      id: `${id}-value`,
      text: value === false ? "—" : value,
      x,
      y,
      width: PLAN_WIDTH,
      height: ROW_HEIGHT,
      fontSize: 24,
      align: "center",
      verticalAlign: "middle",
      color,
    }),
  ];
}

function createFeature(
  feature: (typeof FEATURES)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-row-${index + 1}`;
  const top = HEADER_RULE_Y + index * ROW_HEIGHT;

  return [
    createLayoutText({
      id: `${id}-label`,
      text: feature.label,
      x: TABLE_X,
      y: top,
      width: LABEL_WIDTH,
      height: ROW_HEIGHT,
      fontSize: 26,
      verticalAlign: "middle",
    }),
    ...feature.values.flatMap((value, plan) =>
      createCell(
        `${id}-plan-${plan + 1}`,
        value,
        planX(plan),
        top,
        PLANS[plan].highlighted ? WKND_COLORS.white : WKND_COLORS.black,
      ),
    ),
  ];
}

function createPlanHeader(
  plan: (typeof PLANS)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-plan-${index + 1}`;
  const x = planX(index);
  const color = plan.highlighted ? WKND_COLORS.white : WKND_COLORS.black;

  return [
    {
      ...createLayoutText({
        id: `${id}-name`,
        text: plan.name,
        x,
        y: 384,
        width: PLAN_WIDTH,
        height: 46,
        fontSize: 38,
        fontWeight: 600,
        lineHeight: 1.2,
        align: "center",
        color,
      }),
      letterSpacing: -1,
    },
    createLayoutText({
      id: `${id}-price`,
      text: plan.price,
      x,
      y: 434,
      width: PLAN_WIDTH,
      height: 28,
      fontSize: 22,
      align: "center",
      color: plan.highlighted ? WKND_COLORS.white : WKND_COLORS.muted,
      opacity: plan.highlighted ? 0.8 : 1,
    }),
  ];
}

// Blue column behind the recommended plan, with its badge on the top edge.
function createHighlight(): SlideElement[] {
  const index = PLANS.findIndex((plan) => plan.highlighted);
  const x = planX(index);

  return [
    createLayoutShape({
      id: `${ID}-highlight`,
      shapeType: "roundedRectangle",
      x,
      y: HIGHLIGHT_TOP,
      width: PLAN_WIDTH,
      height: TABLE_BOTTOM + HIGHLIGHT_BOTTOM_PADDING - HIGHLIGHT_TOP,
      cornerRadius: 24,
      fill: WKND_COLORS.blue,
    }),
    createLayoutShape({
      id: `${ID}-badge`,
      shapeType: "roundedRectangle",
      x: x + (PLAN_WIDTH - BADGE.width) / 2,
      y: HIGHLIGHT_TOP - BADGE.height / 2,
      width: BADGE.width,
      height: BADGE.height,
      cornerRadius: BADGE.height / 2,
      fill: WKND_COLORS.yellow,
    }),
    createLayoutText({
      id: `${ID}-badge-label`,
      text: "Recommended",
      x: x + (PLAN_WIDTH - BADGE.width) / 2,
      y: HIGHLIGHT_TOP - BADGE.height / 2,
      width: BADGE.width,
      height: BADGE.height,
      fontSize: 22,
      align: "center",
      verticalAlign: "middle",
    }),
  ];
}

// Perched on the highlighted column's top-right corner. Rotation pivots on
// the top-left corner, so offset it to turn the star about its centre.
function createStar(): ImageElement {
  const index = PLANS.findIndex((plan) => plan.highlighted);
  const center = { x: planX(index) + PLAN_WIDTH - 12, y: HIGHLIGHT_TOP - 84 };
  const angle = (STAR_ROTATION * Math.PI) / 180;
  const half = STAR_SIZE / 2;

  return {
    ...createLayoutObject({
      id: `${ID}-object`,
      file: "3d-stars.png",
      size: STAR_SIZE,
      x: Math.round(center.x - half * Math.cos(angle) + half * Math.sin(angle)),
      y: Math.round(center.y - half * Math.sin(angle) - half * Math.cos(angle)),
    }),
    rotation: STAR_ROTATION,
  };
}

export const WKND_TABLE_PACKAGES_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Choose Your Package",
  category: "table",
  slide: attachDynamicTable({
    id: `layout-${ID}`,
    background: WKND_COLORS.cream,
    elements: [
      ...createFrameElements(ID, "dark"),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Packages",
        x: gridX(1),
        y: gridY(1),
        width: 160,
        height: 50,
        fontSize: 24,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Choose your package",
          x: gridX(1),
          y: 180,
          width: gridWidth(14),
          height: 100,
          fontSize: 96,
          fontWeight: 600,
          lineHeight: 1.04,
        }),
        letterSpacing: -4,
      },
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "Three engagement levels, tailored to where your brand is today.",
        x: gridX(1),
        y: 304,
        width: gridWidth(12),
        height: 32,
        fontSize: 26,
        color: WKND_COLORS.muted,
      }),
      // Rules sit behind the highlighted column so it reads as one block.
      createRule(`${ID}-header-rule`, HEADER_RULE_Y),
      ...FEATURES.map((_, index) =>
        createRule(
          `${ID}-row-${index + 1}-divider`,
          HEADER_RULE_Y + (index + 1) * ROW_HEIGHT,
        ),
      ),
      ...createHighlight(),
      createLayoutText({
        id: `${ID}-header-label`,
        text: "What's included",
        x: TABLE_X,
        y: 396,
        width: LABEL_WIDTH,
        height: 30,
        fontSize: 24,
        color: WKND_COLORS.muted,
      }),
      ...PLANS.flatMap(createPlanHeader),
      ...FEATURES.flatMap(createFeature),
      createStar(),
    ],
  }, "packages", ID),
};
