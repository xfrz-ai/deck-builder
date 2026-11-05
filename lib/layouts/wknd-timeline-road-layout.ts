import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutHeader,
  createLayoutObject,
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
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-timeline-road";
const NODE_SIZE = 56;
const TEXT_SPAN = 4;
const TEXT_GAP = 16;
// Week label, title and a two-line description.
const TEXT_BLOCK_HEIGHT = 128;
const DOT_SIZE = 5;
const DOT_SPACING = 20;
// Dots stop short of each milestone so the circles sit in a clear gap.
const DOT_CLEARANCE = NODE_SIZE / 2 + 12;
const SAMPLES_PER_SEGMENT = 64;
const ARROW_SIZE = 920;

interface Point {
  x: number;
  y: number;
}

// Each milestone is centred in a grid module; its text sits above or below.
const STEPS = [
  {
    column: 2,
    row: 9,
    text: "above",
    week: "Week 1–2",
    title: "Discovery",
    description: "Research, stakeholder interviews and brand audit",
  },
  {
    column: 7,
    row: 11,
    text: "above",
    week: "Week 3–4",
    title: "Strategy",
    description: "Positioning, goals and creative direction",
  },
  {
    column: 12,
    row: 9,
    text: "below",
    week: "Week 5–8",
    title: "Design",
    description: "Concepts, UI design and prototyping",
  },
  {
    column: 16,
    row: 7,
    text: "below",
    week: "Week 9–12",
    title: "Development",
    description: "Build, integration and QA testing",
  },
  {
    column: 20,
    row: 5,
    text: "below",
    week: "Week 13",
    title: "Launch",
    description: "Go-live, handover and optimisation",
  },
] as const;

type TimelineStep = (typeof STEPS)[number];

function stepCenter({ column, row }: TimelineStep): Point {
  return {
    x: gridX(column) + LAYOUT_GRID.columnWidth / 2,
    y: gridY(row) + LAYOUT_GRID.rowHeight / 2,
  };
}

const NODE_CENTERS = STEPS.map(stepCenter);
// The road enters from the left edge and runs on under the 3D arrow.
const ROAD_POINTS: Point[] = [
  { x: -48, y: 624 },
  ...NODE_CENTERS,
  { x: 1716, y: 336 },
];

function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  const blend = (a: number, b: number, c: number, d: number) =>
    0.5 *
    (2 * b +
      (c - a) * t +
      (2 * a - 5 * b + 4 * c - d) * t2 +
      (3 * b - a - 3 * c + d) * t3);

  return {
    x: blend(p0.x, p1.x, p2.x, p3.x),
    y: blend(p0.y, p1.y, p2.y, p3.y),
  };
}

// Dots spaced evenly along a smooth curve through `points`.
function sampleDots(points: Point[]) {
  const first = points[0];
  const last = points[points.length - 1];
  const padded = [
    { x: 2 * first.x - points[1].x, y: 2 * first.y - points[1].y },
    ...points,
    {
      x: 2 * last.x - points[points.length - 2].x,
      y: 2 * last.y - points[points.length - 2].y,
    },
  ];
  const dots: Point[] = [first];
  let previous = first;
  let travelled = 0;

  for (let index = 1; index < padded.length - 2; index += 1) {
    for (let step = 1; step <= SAMPLES_PER_SEGMENT; step += 1) {
      const point = catmullRom(
        padded[index - 1],
        padded[index],
        padded[index + 1],
        padded[index + 2],
        step / SAMPLES_PER_SEGMENT,
      );

      travelled += Math.hypot(point.x - previous.x, point.y - previous.y);
      previous = point;

      if (travelled >= DOT_SPACING) {
        dots.push(point);
        travelled = 0;
      }
    }
  }

  return dots.filter((dot) =>
    NODE_CENTERS.every(
      (center) =>
        Math.hypot(dot.x - center.x, dot.y - center.y) > DOT_CLEARANCE,
    ),
  );
}

function createRoad(): SlideElement[] {
  return sampleDots(ROAD_POINTS).map((dot, index) => ({
    ...createLayoutShape({
      id: `${ID}-road-dot-${index + 1}`,
      shapeType: "circle",
      x: Math.round(dot.x - DOT_SIZE / 2),
      y: Math.round(dot.y - DOT_SIZE / 2),
      width: DOT_SIZE,
      height: DOT_SIZE,
      fill: WKND_COLORS.white,
    }),
    // Locked so the many small dots don't get picked up by clicks.
    locked: true,
  }));
}

function createStep(step: TimelineStep, index: number): SlideElement[] {
  const id = `${ID}-step-${index + 1}`;
  const center = NODE_CENTERS[index];
  const isLast = index === STEPS.length - 1;
  const nodeTop = center.y - NODE_SIZE / 2;
  const textX = gridX(step.column);
  const textWidth = gridWidth(TEXT_SPAN);
  const textTop =
    step.text === "above"
      ? nodeTop - TEXT_GAP - TEXT_BLOCK_HEIGHT
      : nodeTop + NODE_SIZE + TEXT_GAP;

  return [
    createLayoutShape({
      id: `${id}-node`,
      shapeType: "circle",
      x: center.x - NODE_SIZE / 2,
      y: nodeTop,
      width: NODE_SIZE,
      height: NODE_SIZE,
      fill: isLast ? WKND_COLORS.orange : WKND_COLORS.white,
    }),
    createLayoutText({
      id: `${id}-number`,
      text: String(index + 1).padStart(2, "0"),
      x: center.x - NODE_SIZE / 2,
      y: nodeTop,
      width: NODE_SIZE,
      height: NODE_SIZE,
      fontSize: 20,
      fontWeight: 600,
      align: "center",
      verticalAlign: "middle",
      color: isLast ? WKND_COLORS.white : WKND_COLORS.blue,
    }),
    createLayoutText({
      id: `${id}-week`,
      text: step.week,
      x: textX,
      y: textTop,
      width: textWidth,
      height: 24,
      fontSize: 18,
      color: WKND_COLORS.white,
      opacity: 0.8,
    }),
    {
      ...createLayoutText({
        id: `${id}-title`,
        text: step.title,
        x: textX,
        y: textTop + 30,
        width: textWidth,
        height: 40,
        fontSize: 32,
        fontWeight: 600,
        color: WKND_COLORS.white,
      }),
      letterSpacing: -0.5,
    },
    createLayoutText({
      id: `${id}-description`,
      text: step.description,
      x: textX,
      y: textTop + 80,
      // A gutter narrower than the title so lines wrap clear of the road.
      width: textWidth - LAYOUT_GRID.gutter,
      height: 48,
      fontSize: 18,
      lineHeight: 1.3,
      color: WKND_COLORS.white,
      opacity: 0.8,
    }),
  ];
}

export const WKND_TIMELINE_ROAD_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Road to Launch",
  category: "timeline",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      ...createFrameElements(ID, "light"),
      ...createRoad(),
      // Cropped by the top-right corner; the road ends underneath it.
      createLayoutObject({
        id: `${ID}-object`,
        file: "3d-arrow.png",
        size: ARROW_SIZE,
        x: 1120,
        y: -330,
      }),
      ...createLayoutHeader({
        id: ID,
        eyebrow: "Timeline",
        title: "The road\nto launch.",
        fontSize: 112,
        lineHeight: 0.92,
        color: WKND_COLORS.white,
      }),
      {
        ...createLayoutText({
          id: `${ID}-subtitle`,
          text: "A 13-week journey from first insight\nto launch day.",
          x: gridX(1),
          y: gridY(5) + LAYOUT_GRID.gutter,
          width: gridWidth(8),
          height: 72,
          fontSize: 28,
          lineHeight: 1.28,
          color: WKND_COLORS.white,
        }),
        opacity: 0.8,
      },
      ...STEPS.flatMap(createStep),
    ],
  },
};
