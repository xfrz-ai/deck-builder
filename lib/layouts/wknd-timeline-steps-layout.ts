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

const ID = "wknd-timeline-steps";
// Five equal steps span the full content width, one gutter apart.
const STEP_GAP = LAYOUT_GRID.gutter;
const STEP_WIDTH = (gridWidth(LAYOUT_GRID.columns) - STEP_GAP * 4) / 5;
const STEP_BOTTOM = gridY(12);
const STEP_BASE_HEIGHT = 200;
const STEP_RISE = 100;
const STEP_PADDING = 28;

const STEPS = [
  { title: "Discovery", week: "Week 1–2" },
  {
    title: "Strategy",
    week: "Week 3–4",
    description: "Positioning, goals and creative direction",
  },
  {
    title: "Design",
    week: "Week 5–8",
    description: "Concepts, UI design and prototyping",
  },
  {
    title: "Development",
    week: "Week 9–12",
    description: "Build, integration and QA testing",
  },
  {
    title: "Launch",
    week: "Week 13",
    description: "Go-live, handover and optimisation",
  },
] as const;

function stepX(index: number) {
  return gridX(1) + index * (STEP_WIDTH + STEP_GAP);
}

function stepTop(index: number) {
  return STEP_BOTTOM - STEP_BASE_HEIGHT - index * STEP_RISE;
}

function createStep(
  step: (typeof STEPS)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-step-${index + 1}`;
  const x = stepX(index);
  const top = stepTop(index);
  const contentX = x + STEP_PADDING;
  const contentWidth = STEP_WIDTH - STEP_PADDING * 2;
  const isLast = index === STEPS.length - 1;

  return [
    createLayoutShape({
      id: `${id}-card`,
      shapeType: "roundedRectangle",
      x,
      y: top,
      width: STEP_WIDTH,
      height: STEP_BOTTOM - top,
      cornerRadius: 24,
      fill: isLast ? WKND_COLORS.yellow : WKND_COLORS.cream,
    }),
    createLayoutText({
      id: `${id}-number`,
      text: String(index + 1).padStart(2, "0"),
      x: contentX,
      y: top + 32,
      width: contentWidth,
      height: 24,
      fontSize: 20,
      color: WKND_COLORS.muted,
    }),
    {
      ...createLayoutText({
        id: `${id}-title`,
        text: step.title,
        x: contentX,
        y: top + 68,
        width: contentWidth,
        height: 44,
        fontSize: 36,
        fontWeight: 600,
      }),
      letterSpacing: -0.5,
    },
    createLayoutText({
      id: `${id}-week`,
      text: step.week,
      x: contentX,
      y: top + 120,
      width: contentWidth,
      height: 26,
      fontSize: 21,
      color: WKND_COLORS.muted,
    }),
    // The first step is too short for a description.
    ...("description" in step
      ? [
          createLayoutText({
            id: `${id}-description`,
            text: step.description,
            x: contentX,
            y: top + 158,
            width: contentWidth,
            height: 48,
            fontSize: 18,
            lineHeight: 1.3,
            color: WKND_COLORS.muted,
          }),
        ]
      : []),
  ];
}

export const WKND_TIMELINE_STEPS_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Step by Step",
  category: "timeline",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      ...createFrameElements(ID, "light"),
      ...createLayoutHeader({
        id: ID,
        eyebrow: "Timeline",
        title: "Step by Step",
        fontSize: 112,
        lineHeight: 0.92,
        titleLines: 1,
        titleWidth: gridWidth(12),
        color: WKND_COLORS.white,
      }),
      {
        ...createLayoutText({
          id: `${ID}-subtitle`,
          text: "Every phase builds on the last — five steps\nto launch.",
          x: gridX(1),
          y: gridY(4),
          width: gridWidth(8),
          height: 72,
          fontSize: 28,
          lineHeight: 1.28,
          color: WKND_COLORS.white,
        }),
        opacity: 0.8,
      },
      ...STEPS.flatMap(createStep),
      // The arrow's tip rests on the corner of step 4; the star stands on
      // top of the last step.
      createLayoutObject({
        id: `${ID}-object-arrow`,
        file: "3d-arrow.png",
        size: 160,
        x: stepX(3) - 116,
        y: stepTop(3) - 128,
      }),
      createLayoutObject({
        id: `${ID}-object-stars`,
        file: "3d-stars.png",
        size: 264,
        x: stepX(4) + (STEP_WIDTH - 264) / 2,
        y: stepTop(4) - 248,
      }),
    ],
  },
};
