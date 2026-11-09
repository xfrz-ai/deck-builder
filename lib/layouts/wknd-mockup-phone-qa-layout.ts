import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutPhone,
  createLayoutPill,
  createLayoutShape,
  createRotatedLayoutObject,
  PHONE_MOCKUP_SOURCE,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridX, LAYOUT_GRID } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-mockup-phone-qa";
const PHONE_WIDTH = 370;
const PHONE_SCALE = PHONE_WIDTH / PHONE_MOCKUP_SOURCE.width;
const PHONE_X = 605;
const PHONE_Y = 176;
// Issue cards on the right, each level with its marker on the phone.
const CONTENT_RIGHT = gridX(LAYOUT_GRID.columns) + LAYOUT_GRID.columnWidth;
const CARD_X = 1225;
const CARD_HEIGHT = 110;
const MARKER_SIZE = 42;
const TITLE_SIZE = 23;
const BADGE_HEIGHT = 34;
const BADGE_DOT = 7;
const BADGE_PADDING = 16;

type Severity = "critical" | "major" | "minor";

const SEVERITY_STYLES: Record<
  Severity,
  { fill: string; ink: string; label: string; labelWidth: number }
> = {
  critical: {
    label: "Critical",
    labelWidth: 56,
    fill: WKND_COLORS.orange,
    ink: WKND_COLORS.white,
  },
  major: {
    label: "Major",
    labelWidth: 44,
    fill: WKND_COLORS.yellow,
    ink: WKND_COLORS.black,
  },
  minor: {
    label: "Minor",
    labelWidth: 44,
    fill: "#ECE8DE",
    ink: WKND_COLORS.black,
  },
};

// `marker` is the point on the 360×740 phone source the issue refers to.
// `titleWidth` is the measured width of the title at 23px, so the severity
// badge can follow it.
const ISSUES: readonly {
  description: string;
  marker: { x: number; y: number };
  severity: Severity;
  title: string;
  titleWidth: number;
}[] = [
  {
    title: "Status bar overlaps header",
    titleWidth: 284,
    description: "On notched devices the header sits under the status bar.",
    severity: "major",
    marker: { x: 309, y: 72 },
  },
  {
    title: "Hero image loads slowly",
    titleWidth: 257,
    description: "3.8s on 4G — image is 2.4 MB, not compressed.",
    severity: "major",
    marker: { x: 266, y: 272 },
  },
  {
    title: "Low text contrast",
    titleWidth: 186,
    description: "Card subtitle is 3.1:1 — below WCAG AA (4.5:1).",
    severity: "minor",
    marker: { x: 246, y: 508 },
  },
  {
    title: "CTA clipped on small screens",
    titleWidth: 307,
    description: "Button is cut off on iPhone SE; users can't continue.",
    severity: "critical",
    marker: { x: 309, y: 658 },
  },
];

const phone = createLayoutPhone({
  id: `${ID}-phone`,
  x: PHONE_X,
  y: PHONE_Y,
  width: PHONE_WIDTH,
});

// Orange numbered circle with a white ring.
function createMarker(
  id: string,
  number: number,
  centerX: number,
  centerY: number,
): SlideElement[] {
  const x = Math.round(centerX - MARKER_SIZE / 2);
  const y = Math.round(centerY - MARKER_SIZE / 2);

  return [
    createLayoutShape({
      id: `${id}-circle`,
      shapeType: "circle",
      x,
      y,
      width: MARKER_SIZE,
      height: MARKER_SIZE,
      fill: WKND_COLORS.orange,
      stroke: WKND_COLORS.white,
      strokeWidth: 3,
    }),
    createLayoutText({
      id: `${id}-number`,
      text: String(number),
      x,
      y,
      width: MARKER_SIZE,
      height: MARKER_SIZE,
      fontSize: 18,
      fontWeight: 600,
      lineHeight: 1,
      align: "center",
      verticalAlign: "middle",
      color: WKND_COLORS.white,
    }),
  ];
}

function createSeverityBadge(
  id: string,
  severity: Severity,
  x: number,
  centerY: number,
): SlideElement[] {
  const style = SEVERITY_STYLES[severity];
  const width = BADGE_PADDING * 2 + BADGE_DOT + 7 + style.labelWidth;
  const y = Math.round(centerY - BADGE_HEIGHT / 2);

  return [
    createLayoutShape({
      id: `${id}-background`,
      shapeType: "roundedRectangle",
      x,
      y,
      width,
      height: BADGE_HEIGHT,
      cornerRadius: BADGE_HEIGHT / 2,
      fill: style.fill,
    }),
    createLayoutShape({
      id: `${id}-dot`,
      shapeType: "circle",
      x: x + BADGE_PADDING,
      y: Math.round(centerY - BADGE_DOT / 2),
      width: BADGE_DOT,
      height: BADGE_DOT,
      fill: style.ink,
    }),
    createLayoutText({
      id: `${id}-label`,
      text: style.label,
      x: x + BADGE_PADDING + BADGE_DOT + 7,
      y,
      width: style.labelWidth + 4,
      height: BADGE_HEIGHT,
      fontSize: 16,
      fontWeight: 600,
      verticalAlign: "middle",
      color: style.ink,
    }),
  ];
}

function createIssue(
  issue: (typeof ISSUES)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-issue-${index + 1}`;
  const markerX = PHONE_X + issue.marker.x * PHONE_SCALE;
  const centerY = Math.round(PHONE_Y + issue.marker.y * PHONE_SCALE);
  const cardY = centerY - CARD_HEIGHT / 2;
  const textX = CARD_X + 79;
  const titleCenterY = centerY - 12;

  return [
    // Dashed leader from the phone marker towards the card.
    createLayoutShape({
      id: `${id}-leader`,
      shapeType: "rectangle",
      x: Math.round(markerX + MARKER_SIZE / 2),
      y: centerY,
      width: Math.round(CARD_X - 50 - (markerX + MARKER_SIZE / 2)),
      height: 0,
      fill: "transparent",
      stroke: WKND_COLORS.orange,
      strokeWidth: 2,
      dashed: true,
    }),
    createLayoutShape({
      id: `${id}-card`,
      shapeType: "roundedRectangle",
      x: CARD_X,
      y: cardY,
      width: CONTENT_RIGHT - CARD_X,
      height: CARD_HEIGHT,
      cornerRadius: 20,
      fill: WKND_COLORS.white,
      stroke: "#EDE8DA",
      strokeWidth: 1,
    }),
    ...createMarker(`${id}-badge`, index + 1, CARD_X + 40, centerY - 11),
    {
      ...createLayoutText({
        id: `${id}-title`,
        text: issue.title,
        x: textX,
        y: Math.round(titleCenterY - 14),
        width: issue.titleWidth + 8,
        height: 28,
        fontSize: TITLE_SIZE,
        fontWeight: 600,
      }),
      letterSpacing: -TITLE_SIZE * 0.02,
    },
    ...createSeverityBadge(
      `${id}-severity`,
      issue.severity,
      textX + issue.titleWidth + 13,
      titleCenterY,
    ),
    createLayoutText({
      id: `${id}-description`,
      text: issue.description,
      x: textX,
      y: centerY + 13,
      width: CONTENT_RIGHT - textX - 24,
      height: 26,
      fontSize: 17,
      lineHeight: 1.5,
      color: WKND_COLORS.muted,
    }),
    ...createMarker(`${id}-marker`, index + 1, markerX, centerY),
  ];
}

export const WKND_MOCKUP_PHONE_QA_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "QA Review",
  category: "iphone",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.cream,
    elements: [
      createRotatedLayoutObject({
        id: `${ID}-object`,
        file: "3d-stars.png",
        size: 185,
        center: { x: 416, y: 815 },
        rotation: 15,
      }),
      phone,
      ...createFrameElements(ID),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "QA Testing",
        x: gridX(1),
        y: 293,
        width: 150,
        height: 46,
        fontSize: 22,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Home screen\nreview.",
          x: gridX(1),
          y: 388,
          width: 480,
          height: 130,
          fontSize: 64,
          fontWeight: 600,
          lineHeight: 1,
        }),
        letterSpacing: -64 * 0.04,
      },
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "Sprint 12 · Build v2.4.0 · iOS & Android. Four issues found during exploratory testing.",
        x: gridX(1),
        y: 540,
        width: 420,
        height: Math.ceil(3 * 22 * 1.5) + 2,
        fontSize: 22,
        lineHeight: 1.5,
        color: WKND_COLORS.muted,
      }),
      ...ISSUES.flatMap(createIssue),
    ],
  },
};
