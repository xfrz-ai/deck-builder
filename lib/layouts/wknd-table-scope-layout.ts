import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutPill,
  createLayoutShape,
  createRotatedLayoutObject,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridX, LAYOUT_GRID } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-table-scope";
// The header sits above grid row 1 so the table card gets the full height.
const PILL_Y = 96;
const TITLE_Y = 166;
const SUBTITLE_Y = 282;
const LEGEND_CENTER_Y = 314;
// Measured 161px and 199px at 22px, plus headroom so neither wraps.
const LEGEND_LABEL_WIDTH = { leads: 172, supports: 206 } as const;
// Cream card spanning the content width, with 40px inner padding.
const CARD_X = gridX(1);
const CARD_RIGHT = gridX(LAYOUT_GRID.columns) + LAYOUT_GRID.columnWidth;
const CARD_Y = 352;
const CARD_PADDING = 40;
const INNER_X = CARD_X + CARD_PADDING;
const INNER_RIGHT = CARD_RIGHT - CARD_PADDING;
const PHASE_X = [500, 800, 1100, 1400] as const;
const HEADER_RULE_Y = 444;
const ROW_HEIGHT = 88;
const DIVIDER_COLOR = "#E4DFCF";
const BADGE_HEIGHT = 42;
const BADGE_WIDTH = { lead: 88, support: 124 } as const;

type Role = "lead" | "support" | null;

const PHASES = ["01 Discover", "02 Define", "03 Design", "04 Deliver"] as const;

const SERVICES: readonly { label: string; roles: readonly Role[] }[] = [
  { label: "Brand Strategy", roles: ["lead", "lead", "support", null] },
  { label: "Visual Identity", roles: [null, "support", "lead", "support"] },
  { label: "Website", roles: [null, "support", "lead", "lead"] },
  { label: "Social Content", roles: [null, null, "lead", "lead"] },
  { label: "3D Assets", roles: [null, "support", "lead", "support"] },
];

const TABLE_BOTTOM = HEADER_RULE_Y + SERVICES.length * ROW_HEIGHT;
const CARD_HEIGHT = TABLE_BOTTOM + 20 - CARD_Y;

function createRule(id: string, y: number) {
  return createLayoutShape({
    id,
    shapeType: "rectangle",
    x: INNER_X,
    y,
    width: INNER_RIGHT - INNER_X,
    height: 1.5,
    fill: DIVIDER_COLOR,
  });
}

// "Lead" is a filled blue badge, "Support" an outlined one, and no role a
// muted dash.
function createRoleCell(
  id: string,
  role: Role,
  x: number,
  rowY: number,
): SlideElement[] {
  if (!role) {
    return [
      createLayoutText({
        id: `${id}-empty`,
        text: "—",
        x: x + 18,
        y: rowY,
        width: 40,
        height: ROW_HEIGHT,
        fontSize: 18,
        verticalAlign: "middle",
        color: WKND_COLORS.muted,
        opacity: 0.5,
      }),
    ];
  }

  const isLead = role === "lead";
  const width = BADGE_WIDTH[role];
  const y = rowY + (ROW_HEIGHT - BADGE_HEIGHT) / 2;

  return [
    createLayoutShape({
      id: `${id}-badge`,
      shapeType: "roundedRectangle",
      x,
      y,
      width,
      height: BADGE_HEIGHT,
      cornerRadius: BADGE_HEIGHT / 2,
      fill: isLead ? WKND_COLORS.blue : "transparent",
      stroke: WKND_COLORS.blue,
      strokeWidth: 2,
    }),
    createLayoutText({
      id: `${id}-label`,
      text: isLead ? "Lead" : "Support",
      x,
      y,
      width,
      height: BADGE_HEIGHT,
      fontSize: 22,
      align: "center",
      verticalAlign: "middle",
      color: isLead ? WKND_COLORS.white : WKND_COLORS.blue,
    }),
  ];
}

function createServiceRow(
  service: (typeof SERVICES)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-row-${index + 1}`;
  const y = HEADER_RULE_Y + index * ROW_HEIGHT;

  return [
    ...(index > 0 ? [createRule(`${id}-divider`, y)] : []),
    createLayoutText({
      id: `${id}-service`,
      text: service.label,
      x: INNER_X,
      y,
      width: PHASE_X[0] - INNER_X - 24,
      height: ROW_HEIGHT,
      fontSize: 26,
      fontWeight: 600,
      verticalAlign: "middle",
    }),
    ...service.roles.flatMap((role, phase) =>
      createRoleCell(`${id}-phase-${phase + 1}`, role, PHASE_X[phase], y),
    ),
  ];
}

function createHeaderLabel(id: string, text: string, x: number, width: number) {
  return createLayoutText({
    id,
    text,
    x,
    y: CARD_Y + 40,
    width,
    height: 40,
    fontSize: 20,
    verticalAlign: "middle",
    color: WKND_COLORS.muted,
  });
}

// "● Weekend leads  ○ Weekend supports", laid out leftwards from the content
// edge.
function createLegend(): SlideElement[] {
  const dot = 16;
  const dotGap = 10;
  const itemGap = 36;
  const supportsX = CARD_RIGHT - LEGEND_LABEL_WIDTH.supports - dotGap - dot;
  const leadsX = supportsX - itemGap - LEGEND_LABEL_WIDTH.leads - dotGap - dot;
  const items = [
    { key: "leads", label: "Weekend leads", x: leadsX, filled: true },
    { key: "supports", label: "Weekend supports", x: supportsX, filled: false },
  ] as const;

  return items.flatMap((item) => [
    createLayoutShape({
      id: `${ID}-legend-${item.key}-dot`,
      shapeType: "circle",
      x: item.x,
      y: LEGEND_CENTER_Y - dot / 2,
      width: dot,
      height: dot,
      fill: item.filled ? WKND_COLORS.white : "transparent",
      stroke: WKND_COLORS.white,
      strokeWidth: 2,
    }),
    createLayoutText({
      id: `${ID}-legend-${item.key}-label`,
      text: item.label,
      x: item.x + dot + dotGap,
      y: LEGEND_CENTER_Y - 15,
      width: LEGEND_LABEL_WIDTH[item.key],
      height: 30,
      fontSize: 22,
      verticalAlign: "middle",
      color: WKND_COLORS.white,
    }),
  ]);
}

export const WKND_TABLE_SCOPE_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Scope of Work",
  category: "table",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      // K tilted back and cropped by the top-right corner.
      createRotatedLayoutObject({
        id: `${ID}-object-k`,
        file: "3d-k.png",
        size: 270,
        center: { x: 1743, y: 122 },
        rotation: -9,
      }),
      // Small W floating beside the title.
      createRotatedLayoutObject({
        id: `${ID}-object-w`,
        file: "3d-w.png",
        size: 165,
        center: { x: 816, y: 208 },
        rotation: 7,
      }),
      ...createFrameElements(ID, "light"),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Scope",
        x: gridX(1),
        y: PILL_Y,
        width: 122,
        height: 50,
        fontSize: 24,
        color: WKND_COLORS.white,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Scope of Work",
          x: gridX(1),
          y: TITLE_Y,
          width: 660,
          height: 97,
          fontSize: 88,
          fontWeight: 600,
          lineHeight: 1.1,
          color: WKND_COLORS.white,
        }),
        letterSpacing: -88 * 0.04,
      },
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "Who leads what — across every phase of the project.",
        x: gridX(1),
        y: SUBTITLE_Y,
        width: 700,
        height: 34,
        fontSize: 24,
        lineHeight: 1.3,
        color: WKND_COLORS.white,
        opacity: 0.7,
      }),
      ...createLegend(),
      createLayoutShape({
        id: `${ID}-card`,
        shapeType: "roundedRectangle",
        x: CARD_X,
        y: CARD_Y,
        width: CARD_RIGHT - CARD_X,
        height: CARD_HEIGHT,
        cornerRadius: 32,
        fill: WKND_COLORS.cream,
      }),
      createHeaderLabel(
        `${ID}-header-service`,
        "Service",
        INNER_X,
        PHASE_X[0] - INNER_X - 24,
      ),
      ...PHASES.map((phase, index) =>
        createHeaderLabel(
          `${ID}-header-phase-${index + 1}`,
          phase,
          PHASE_X[index],
          276,
        ),
      ),
      createRule(`${ID}-header-rule`, HEADER_RULE_Y),
      ...SERVICES.flatMap(createServiceRow),
    ],
  },
};
