import { attachDynamicTable } from "@/lib/table/table-migration";
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

const ID = "wknd-table-bug-triage";
// A wide cream card holding the issue table, grouped by severity.
const CONTENT_RIGHT = gridX(LAYOUT_GRID.columns) + LAYOUT_GRID.columnWidth;
const CARD = { x: 400, y: 355, width: CONTENT_RIGHT - 400, height: 542 };
const INNER_X = CARD.x + 37;
const INNER_RIGHT = CARD.x + CARD.width - 36;
const COLUMNS = {
  id: { x: INNER_X, width: 110 },
  issue: { x: 560, width: 350 },
  steps: { x: 934, width: 360 },
  expected: { x: 1308, width: 356 },
  status: { x: 1683, width: 140 },
} as const;
const BODY_SIZE = 15;
const BODY_LINE_HEIGHT = 1.5;
const STATUS_HEIGHT = 33;
const DIVIDER_OPACITY = 0.15;

type Status = "fixed" | "in-progress" | "open";

interface Issue {
  actual: string;
  actualLines: number;
  description: string;
  expected: string;
  id: string;
  status: Status;
  steps: readonly string[];
  title: string;
  // Centre of the row's first text line.
  y: number;
}

const GROUPS: readonly {
  color: string;
  issues: readonly Issue[];
  label: string;
  y: number;
}[] = [
  {
    label: "Critical · 2",
    color: WKND_COLORS.orange,
    y: 439,
    issues: [
      {
        id: "BUG-1042",
        y: 478,
        title: "CTA button clipped on small screens",
        description:
          "Users on 4.7” phones cannot tap “Get started”, which blocks sign-up.",
        steps: [
          "1. Open the app on an iPhone SE.",
          "2. Scroll to the bottom of Home.",
          "3. Try to tap “Get started”.",
        ],
        expected: "The button sits fully above the home indicator.",
        actual: "The bottom 18px is clipped and the tap target is too small.",
        actualLines: 2,
        status: "in-progress",
      },
      {
        id: "BUG-1047",
        y: 617,
        title: "Payment page freezes after OTP",
        description: "The bank charges the card, but no order is created.",
        steps: [
          "1. Pay with a credit card.",
          "2. Enter the OTP from the SMS.",
          "3. Wait on the confirmation screen.",
        ],
        expected: "Redirect to “Order placed” within 5 seconds.",
        actual: "The spinner never stops and the order is missing in admin.",
        actualLines: 2,
        status: "open",
      },
    ],
  },
  {
    label: "Major · 1",
    color: WKND_COLORS.yellow,
    y: 757,
    issues: [
      {
        id: "BUG-1051",
        y: 795,
        title: "Search ignores Indonesian keywords",
        description: "“kursi” returns nothing although 40 chairs are listed.",
        steps: ["1. Open Search.", "2. Type “kursi” and submit."],
        expected: "Chairs are listed first.",
        actual: "“No results found” is shown.",
        actualLines: 1,
        status: "fixed",
      },
    ],
  },
];

// Row dividers sit below every issue except the last of the table.
const DIVIDER_Y = [591, 729] as const;

const STATUS_STYLES: Record<
  Status,
  { fill: string; ink: string; label: string; width: number }
> = {
  "in-progress": {
    label: "In progress",
    width: 104,
    fill: "transparent",
    ink: WKND_COLORS.blue,
  },
  open: {
    label: "Open",
    width: 68,
    fill: "transparent",
    ink: WKND_COLORS.orange,
  },
  fixed: {
    label: "Fixed",
    width: 64,
    fill: WKND_COLORS.black,
    ink: WKND_COLORS.white,
  },
};

// A body-sized text box whose first line is centred on `centerY`.
function createBodyText({
  centerY,
  color = WKND_COLORS.black,
  column,
  fontSize = BODY_SIZE,
  fontWeight = 400,
  id,
  lines = 1,
  text,
}: {
  centerY: number;
  color?: string;
  column: keyof typeof COLUMNS;
  fontSize?: number;
  fontWeight?: number;
  id: string;
  lines?: number;
  text: string;
}) {
  const line = fontSize * BODY_LINE_HEIGHT;

  return createLayoutText({
    id,
    text,
    x: COLUMNS[column].x,
    y: Math.round(centerY - line / 2),
    width: COLUMNS[column].width,
    // Konva drops a line that overflows the box by even a fraction.
    height: Math.ceil(lines * line) + 2,
    fontSize,
    fontWeight,
    lineHeight: BODY_LINE_HEIGHT,
    color,
  });
}

function createDivider(id: string, y: number) {
  return {
    ...createLayoutShape({
      id,
      shapeType: "rectangle",
      x: INNER_X,
      y,
      width: INNER_RIGHT - INNER_X,
      height: 1,
      fill: WKND_COLORS.black,
    }),
    opacity: DIVIDER_OPACITY,
  };
}

function createStatus(id: string, status: Status, centerY: number) {
  const style = STATUS_STYLES[status];
  const y = Math.round(centerY - STATUS_HEIGHT / 2);

  return [
    createLayoutShape({
      id: `${id}-outline`,
      shapeType: "roundedRectangle",
      x: COLUMNS.status.x,
      y,
      width: style.width,
      height: STATUS_HEIGHT,
      cornerRadius: STATUS_HEIGHT / 2,
      fill: style.fill,
      stroke: style.fill === "transparent" ? style.ink : style.fill,
      strokeWidth: 1.5,
    }),
    createLayoutText({
      id: `${id}-label`,
      text: style.label,
      x: COLUMNS.status.x,
      y,
      width: style.width,
      height: STATUS_HEIGHT,
      fontSize: 14,
      align: "center",
      verticalAlign: "middle",
      color: style.ink,
    }),
  ];
}

function createIssue(issue: Issue): SlideElement[] {
  const id = `${ID}-${issue.id.toLowerCase()}`;
  const { y } = issue;

  return [
    createBodyText({
      id: `${id}-id`,
      text: issue.id,
      column: "id",
      centerY: y,
      color: WKND_COLORS.muted,
    }),
    createBodyText({
      id: `${id}-title`,
      text: issue.title,
      column: "issue",
      centerY: y,
      fontSize: 17,
      fontWeight: 600,
    }),
    createBodyText({
      id: `${id}-description`,
      text: issue.description,
      column: "issue",
      centerY: y + 29,
      lines: 2,
      color: WKND_COLORS.muted,
    }),
    createBodyText({
      id: `${id}-steps`,
      text: issue.steps.join("\n"),
      column: "steps",
      centerY: y,
      lines: issue.steps.length,
    }),
    createBodyText({
      id: `${id}-expected-label`,
      text: "Expected",
      column: "expected",
      centerY: y - 3,
      fontSize: 13,
      fontWeight: 600,
      color: WKND_COLORS.blue,
    }),
    createBodyText({
      id: `${id}-expected`,
      text: issue.expected,
      column: "expected",
      centerY: y + 18,
    }),
    createBodyText({
      id: `${id}-actual-label`,
      text: "Actual",
      column: "expected",
      centerY: y + 40,
      fontSize: 13,
      fontWeight: 600,
      color: WKND_COLORS.orange,
    }),
    createBodyText({
      id: `${id}-actual`,
      text: issue.actual,
      column: "expected",
      centerY: y + 62,
      lines: issue.actualLines,
    }),
    ...createStatus(`${id}-status`, issue.status, y + 5),
  ];
}

function createGroup(group: (typeof GROUPS)[number], index: number) {
  const id = `${ID}-group-${index + 1}`;
  const dot = 10;

  return [
    createLayoutShape({
      id: `${id}-dot`,
      shapeType: "circle",
      x: INNER_X,
      y: group.y - dot / 2,
      width: dot,
      height: dot,
      fill: group.color,
    }),
    createLayoutText({
      id: `${id}-label`,
      text: group.label,
      x: INNER_X + 18,
      y: group.y - 11,
      width: 200,
      height: 22,
      fontSize: 15,
      fontWeight: 600,
      lineHeight: BODY_LINE_HEIGHT,
    }),
    ...group.issues.flatMap(createIssue),
  ];
}

const HEADERS = [
  { column: "id", label: "ID" },
  { column: "issue", label: "Issue & impact" },
  { column: "steps", label: "Steps to reproduce" },
  { column: "expected", label: "Expected vs. actual" },
  { column: "status", label: "Status" },
] as const;

export const WKND_TABLE_BUG_TRIAGE_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Bug Triage",
  category: "table",
  slide: attachDynamicTable({
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      // Black D tilted back and cropped by the left edge, behind the card.
      createRotatedLayoutObject({
        id: `${ID}-object`,
        file: "3d-d.png",
        size: 781,
        center: { x: 127, y: 704 },
        rotation: -11,
      }),
      ...createFrameElements(ID, "light"),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Bug Triage",
        x: gridX(1),
        y: 140,
        width: 162,
        height: 50,
        fontSize: 24,
        color: WKND_COLORS.white,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Open issues by severity",
          x: gridX(1),
          y: 203,
          width: 900,
          height: 80,
          fontSize: 72,
          fontWeight: 600,
          lineHeight: 1.1,
          color: WKND_COLORS.white,
        }),
        letterSpacing: -72 * 0.04,
      },
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "Sprint 12 · sorted by impact on the purchase journey",
        x: gridX(1),
        y: 297,
        width: 700,
        height: 29,
        fontSize: 22,
        lineHeight: 1.3,
        color: WKND_COLORS.white,
        opacity: 0.75,
      }),
      createLayoutShape({
        id: `${ID}-card`,
        shapeType: "roundedRectangle",
        ...CARD,
        cornerRadius: 32,
        fill: WKND_COLORS.cream,
      }),
      ...HEADERS.map((header) =>
        createBodyText({
          id: `${ID}-header-${header.column}`,
          text: header.label,
          column: header.column,
          centerY: 390,
          fontSize: 14,
          color: WKND_COLORS.muted,
        }),
      ),
      createDivider(`${ID}-header-rule`, 411),
      ...GROUPS.flatMap(createGroup),
      ...DIVIDER_Y.map((y, index) =>
        createDivider(`${ID}-divider-${index + 1}`, y),
      ),
    ],
  }, "triage", ID),
};
