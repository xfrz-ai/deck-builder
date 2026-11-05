import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
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

const ID = "wknd-timeline-roadmap";
// Twelve months spread across the full content width.
const CHART_X = gridX(1);
const CHART_WIDTH = gridWidth(LAYOUT_GRID.columns);
const MONTH_WIDTH = CHART_WIDTH / 12;
// Quarter labels sit in row 4; bars start in the row below.
const CHART_TOP = gridY(4);
const CHART_BOTTOM = gridY(12) + LAYOUT_GRID.rowHeight - LAYOUT_GRID.gutter;
const BAR_TOP = CHART_TOP + LAYOUT_GRID.rowHeight;
const BAR_HEIGHT = 88;
const BAR_PITCH = 104;
const BAR_PADDING = 28;
const GRID_LINE_COLOR = "#2E2E2E";

// `start` and `end` are in months from January (0) to December's end (12).
// `nameWidth` is the phase name's rendered width at 28px, so the date range
// can follow it.
const PHASES = [
  {
    name: "Discovery",
    nameWidth: 136,
    range: "Jan – Feb",
    start: 0,
    end: 2,
    fill: WKND_COLORS.blue,
  },
  {
    name: "Strategy",
    nameWidth: 118,
    range: "Feb – May",
    start: 1.5,
    end: 4.5,
    fill: WKND_COLORS.orange,
  },
  {
    name: "Design",
    nameWidth: 94,
    range: "Apr – Aug",
    start: 3.5,
    end: 8,
    fill: WKND_COLORS.yellow,
  },
  {
    name: "Development",
    nameWidth: 188,
    range: "Aug – Nov",
    start: 7,
    end: 11,
    fill: WKND_COLORS.cream,
  },
  {
    name: "Launch",
    nameWidth: 100,
    range: "Oct – Dec",
    start: 10,
    end: 12,
    fill: WKND_COLORS.blue,
  },
] as const;

function monthX(month: number) {
  return CHART_X + month * MONTH_WIDTH;
}

function createQuarters(): SlideElement[] {
  return [0, 1, 2, 3, 4].flatMap((quarter) => {
    const x = monthX(quarter * 3);
    const line = createLayoutShape({
      id: `${ID}-quarter-${quarter + 1}-line`,
      shapeType: "rectangle",
      x,
      y: CHART_TOP,
      width: 1,
      height: CHART_BOTTOM - CHART_TOP,
      fill: GRID_LINE_COLOR,
    });

    if (quarter === 4) {
      return [line];
    }

    return [
      line,
      {
        ...createLayoutText({
          id: `${ID}-quarter-${quarter + 1}-label`,
          text: `Q${quarter + 1} 2026`,
          x: x + 20,
          y: CHART_TOP + 8,
          width: MONTH_WIDTH * 3 - 40,
          height: 32,
          fontSize: 24,
          color: WKND_COLORS.white,
        }),
        opacity: 0.6,
      },
    ];
  });
}

function createPhase(
  phase: (typeof PHASES)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-phase-${index + 1}`;
  const x = monthX(phase.start);
  const y = BAR_TOP + index * BAR_PITCH;
  const width = monthX(phase.end) - x;
  const isLight =
    phase.fill === WKND_COLORS.yellow || phase.fill === WKND_COLORS.cream;
  const color = isLight ? WKND_COLORS.black : WKND_COLORS.white;
  const rangeX = x + BAR_PADDING + phase.nameWidth + 14;

  return [
    createLayoutShape({
      id: `${id}-bar`,
      shapeType: "roundedRectangle",
      x,
      y,
      width,
      height: BAR_HEIGHT,
      cornerRadius: BAR_HEIGHT / 2,
      fill: phase.fill,
    }),
    {
      ...createLayoutText({
        id: `${id}-name`,
        text: phase.name,
        x: x + BAR_PADDING,
        y,
        // Extra room so a slightly wider font never wraps the name.
        width: phase.nameWidth + 24,
        height: BAR_HEIGHT,
        fontSize: 28,
        fontWeight: 600,
        verticalAlign: "middle",
        color,
      }),
      letterSpacing: -0.5,
    },
    createLayoutText({
      id: `${id}-range`,
      text: phase.range,
      x: rangeX,
      y,
      width: Math.max(x + width - BAR_PADDING - rangeX, 120),
      height: BAR_HEIGHT,
      fontSize: 21,
      verticalAlign: "middle",
      color,
      opacity: 0.75,
    }),
  ];
}

export const WKND_TIMELINE_ROADMAP_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Roadmap 2026",
  category: "timeline",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.black,
    darkMode: true,
    elements: [
      ...createFrameElements(ID, "light"),
      createLayoutObject({
        id: `${ID}-object-n`,
        file: "3d-n-white.png",
        size: 280,
        x: 1550,
        y: 24,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Roadmap 2026",
          x: gridX(1),
          // No eyebrow here, so the title rises a gutter above row 1.
          y: gridY(1) - LAYOUT_GRID.gutter,
          width: gridWidth(14),
          height: 104,
          fontSize: 112,
          fontWeight: 600,
          lineHeight: 0.92,
          color: WKND_COLORS.white,
        }),
        letterSpacing: -4.5,
      },
      {
        ...createLayoutText({
          id: `${ID}-subtitle`,
          text: "From discovery to launch in one quarter-by-quarter view.",
          x: gridX(1),
          y: gridY(3) - LAYOUT_GRID.gutter,
          width: gridWidth(14),
          height: 36,
          fontSize: 28,
          color: WKND_COLORS.white,
        }),
        opacity: 0.7,
      },
      ...createQuarters(),
      ...PHASES.flatMap(createPhase),
      // Perched on the end of the launch bar.
      createLayoutObject({
        id: `${ID}-object-stars`,
        file: "3d-stars.png",
        size: 164,
        x: 1714,
        y: BAR_TOP + 4 * BAR_PITCH - 136,
      }),
    ],
  },
};
