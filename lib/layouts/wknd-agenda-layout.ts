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
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-agenda";
// 09:00–12:00 on a linear scale across the full content width.
const START_MINUTE = 9 * 60;
const TOTAL_MINUTES = 180;
const SCALE_X = gridX(1);
const SCALE_WIDTH = gridWidth(LAYOUT_GRID.columns);
const AXIS_Y = 628;
const LABEL_WIDTH = 80;
const TICK_HEIGHT = 10;
const SESSION_TOP = 648;
const SESSION_HEIGHT = 228;
const SESSION_GAP = 12;
const SESSION_PADDING = 22;
const META_TOP = gridY(6);
const META_HEIGHT = 44;
const META_GAP = 12;
const D_SIZE = 882;

// `width` is each pill's width, sized to its label at 22px.
const META = [
  { text: "Monday, 9 Nov", width: 184 },
  { text: "09:00 – 12:00", width: 180 },
  { text: "Weekend HQ", width: 172 },
] as const;

// Consecutive sessions; each starts where the previous one ends.
const SESSIONS = [
  { title: "Welcome\n& intros", minutes: 20, fill: WKND_COLORS.black },
  { title: "The brief", minutes: 30, fill: WKND_COLORS.black },
  { title: "Our approach", minutes: 45, fill: WKND_COLORS.blue },
  { title: "Break", minutes: 15, fill: "transparent" },
  { title: "Timeline", minutes: 30, fill: WKND_COLORS.black },
  { title: "Next steps & Q&A", minutes: 40, fill: WKND_COLORS.black },
] as const;

function timeX(minute: number) {
  return SCALE_X + ((minute - START_MINUTE) / TOTAL_MINUTES) * SCALE_WIDTH;
}

function formatTime(minute: number) {
  const hours = String(Math.floor(minute / 60)).padStart(2, "0");
  const minutes = String(minute % 60).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function createMeta(): SlideElement[] {
  let x = gridX(1);

  return META.flatMap((item, index) => {
    const pill = createLayoutPill({
      id: `${ID}-meta-${index + 1}`,
      text: item.text,
      x,
      y: META_TOP,
      width: item.width,
      height: META_HEIGHT,
      fontSize: 22,
    });

    x += item.width + META_GAP;

    return pill;
  });
}

// Half-hour labels with a tick every quarter hour.
function createScale(): SlideElement[] {
  const elements: SlideElement[] = [
    createLayoutShape({
      id: `${ID}-axis`,
      shapeType: "rectangle",
      x: SCALE_X,
      y: AXIS_Y,
      width: SCALE_WIDTH,
      height: 1.5,
      fill: WKND_COLORS.black,
    }),
  ];

  for (
    let minute = START_MINUTE;
    minute <= START_MINUTE + TOTAL_MINUTES;
    minute += 15
  ) {
    const x = timeX(minute);
    const isLabelled = (minute - START_MINUTE) % 30 === 0;

    elements.push({
      ...createLayoutShape({
        id: `${ID}-tick-${formatTime(minute)}`,
        shapeType: "rectangle",
        x: x - 0.75,
        y: AXIS_Y - TICK_HEIGHT,
        width: 1.5,
        height: TICK_HEIGHT,
        fill: WKND_COLORS.black,
      }),
      opacity: isLabelled ? 1 : 0.5,
    });

    if (!isLabelled) {
      continue;
    }

    // The end labels align to the scale's edges; the rest centre on the tick.
    const isFirst = minute === START_MINUTE;
    const isLast = minute === START_MINUTE + TOTAL_MINUTES;

    elements.push(
      createLayoutText({
        id: `${ID}-label-${formatTime(minute)}`,
        text: formatTime(minute),
        x: isFirst ? x : isLast ? x - LABEL_WIDTH : x - LABEL_WIDTH / 2,
        y: AXIS_Y - 44,
        width: LABEL_WIDTH,
        height: 24,
        fontSize: 18,
        align: isFirst ? "left" : isLast ? "right" : "center",
        opacity: 0.7,
      }),
    );
  }

  return elements;
}

function createSessions(): SlideElement[] {
  let start = START_MINUTE;

  return SESSIONS.flatMap((session, index) => {
    const id = `${ID}-session-${index + 1}`;
    const x = timeX(start);
    const isLast = index === SESSIONS.length - 1;
    const width =
      timeX(start + session.minutes) - x - (isLast ? 0 : SESSION_GAP);
    const isBreak = session.fill === "transparent";
    const color = isBreak ? WKND_COLORS.black : WKND_COLORS.white;
    const contentX = x + SESSION_PADDING;
    const contentWidth = width - SESSION_PADDING * 2;
    const time = formatTime(start);

    start += session.minutes;

    return [
      createLayoutShape({
        id: `${id}-card`,
        shapeType: "roundedRectangle",
        x,
        y: SESSION_TOP,
        width,
        height: SESSION_HEIGHT,
        cornerRadius: 16,
        fill: session.fill,
        ...(isBreak
          ? { stroke: WKND_COLORS.black, strokeWidth: 2, dashed: true }
          : {}),
      }),
      createLayoutText({
        id: `${id}-time`,
        text: time,
        x: contentX,
        y: SESSION_TOP + 22,
        width: contentWidth,
        height: 24,
        fontSize: 19,
        color,
        opacity: 0.7,
      }),
      {
        ...createLayoutText({
          id: `${id}-title`,
          text: session.title,
          x: contentX,
          y: SESSION_TOP + 50,
          width: contentWidth,
          height: 64,
          fontSize: 26,
          fontWeight: 600,
          lineHeight: 1.12,
          color,
        }),
        letterSpacing: -0.5,
      },
      createLayoutText({
        id: `${id}-duration`,
        text: `${session.minutes} min`,
        x: contentX,
        y: SESSION_TOP + SESSION_HEIGHT - 50,
        width: contentWidth,
        height: 24,
        fontSize: 19,
        color,
      }),
    ];
  });
}

export const WKND_AGENDA_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Today's Agenda",
  category: "agenda",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.yellow,
    elements: [
      // Cropped by the top-right corner, dot and all.
      createLayoutObject({
        id: `${ID}-object`,
        file: "3d-d.png",
        size: D_SIZE,
        x: 1302,
        y: -358,
      }),
      ...createFrameElements(ID, "dark"),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Kick-off Workshop",
        x: gridX(1),
        y: gridY(1),
        width: 252,
        height: 50,
        fontSize: 24,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Today's\nagenda.",
          x: gridX(1),
          y: 204,
          width: gridWidth(12),
          height: 256,
          fontSize: 132,
          fontWeight: 600,
          lineHeight: 0.94,
        }),
        letterSpacing: -6,
      },
      ...createMeta(),
      ...createScale(),
      ...createSessions(),
    ],
  },
};
