import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPill,
  createLayoutShape,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridWidth, gridX, gridY } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-agenda-chapters";
// The contents table spans columns 13–24.
const TABLE_X = gridX(13);
const TABLE_WIDTH = gridWidth(12);
const TABLE_TOP = 228;
const ROW_HEIGHT = 106;
const TITLE_X = TABLE_X + 64;
const DIVIDER_COLOR = "#E4DFCF";
const DOT_SIZE = 3;
const DOT_SPACING = 12;
const DOT_GAP = 28;

// `titleWidth` is each title's rendered width at 53px, so the dotted leader
// can start just after it.
const CHAPTERS = [
  { title: "Introduction", titleWidth: 300 },
  { title: "Our Team", titleWidth: 228 },
  { title: "The Brief", titleWidth: 210 },
  { title: "Our Approach", titleWidth: 342 },
  { title: "Timeline", titleWidth: 198 },
  { title: "Next Steps", titleWidth: 264 },
] as const;

// Dots laid out from the right edge so every leader ends flush.
function createLeader(id: string, fromX: number, centerY: number) {
  const right = TABLE_X + TABLE_WIDTH;
  const count = Math.floor((right - fromX) / DOT_SPACING);

  return Array.from({ length: count }, (_, index) => ({
    ...createLayoutShape({
      id: `${id}-dot-${index + 1}`,
      shapeType: "circle",
      x: right - DOT_SIZE - index * DOT_SPACING,
      y: centerY - DOT_SIZE / 2,
      width: DOT_SIZE,
      height: DOT_SIZE,
      fill: WKND_COLORS.muted,
    }),
    // Locked so the many small dots don't get picked up by clicks.
    locked: true,
    opacity: 0.6,
  }));
}

function createChapter(
  chapter: (typeof CHAPTERS)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-chapter-${index + 1}`;
  const top = TABLE_TOP + index * ROW_HEIGHT;

  return [
    createLayoutText({
      id: `${id}-number`,
      text: String(index + 1).padStart(2, "0"),
      x: TABLE_X,
      y: top,
      width: 56,
      height: ROW_HEIGHT,
      fontSize: 22,
      verticalAlign: "middle",
      color: WKND_COLORS.muted,
    }),
    {
      ...createLayoutText({
        id: `${id}-title`,
        text: chapter.title,
        x: TITLE_X,
        y: top,
        // Extra room so a slightly wider font never wraps the title.
        width: chapter.titleWidth + 24,
        height: ROW_HEIGHT,
        fontSize: 53,
        fontWeight: 600,
        verticalAlign: "middle",
      }),
      letterSpacing: -2,
    },
    ...createLeader(
      id,
      TITLE_X + chapter.titleWidth + DOT_GAP,
      top + ROW_HEIGHT / 2,
    ),
    createLayoutShape({
      id: `${id}-divider`,
      shapeType: "rectangle",
      x: TABLE_X,
      y: top + ROW_HEIGHT,
      width: TABLE_WIDTH,
      height: 1.5,
      fill: DIVIDER_COLOR,
    }),
  ];
}

export const WKND_AGENDA_CHAPTERS_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "What's Inside",
  category: "agenda",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.cream,
    elements: [
      // Mostly off the bottom-left corner: only the triangle's tip and the
      // quarter circle show.
      createLayoutObject({
        id: `${ID}-object`,
        file: "3d-k.png",
        size: 912,
        x: -227,
        y: 598,
      }),
      ...createFrameElements(ID, "dark"),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Agenda",
        x: gridX(1),
        y: gridY(1),
        width: 134,
        height: 50,
        fontSize: 24,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "What's\ninside.",
          x: gridX(1),
          y: 204,
          width: gridWidth(10),
          height: 296,
          fontSize: 150,
          fontWeight: 600,
          lineHeight: 0.95,
        }),
        letterSpacing: -6,
      },
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "Six chapters, one story — from who we are to\nhow we kick off together.",
        x: gridX(1),
        y: 516,
        width: gridWidth(9),
        height: 72,
        fontSize: 24,
        lineHeight: 1.33,
        color: WKND_COLORS.muted,
      }),
      createLayoutText({
        id: `${ID}-header-chapter`,
        text: "Chapter",
        x: TABLE_X,
        y: 190,
        width: 160,
        height: 24,
        fontSize: 18,
        color: WKND_COLORS.muted,
      }),
      createLayoutText({
        id: `${ID}-header-page`,
        text: "Page",
        x: TABLE_X + TABLE_WIDTH - 160,
        y: 190,
        width: 160,
        height: 24,
        fontSize: 18,
        align: "right",
        color: WKND_COLORS.muted,
      }),
      createLayoutShape({
        id: `${ID}-header-rule`,
        shapeType: "rectangle",
        x: TABLE_X,
        y: TABLE_TOP - 2,
        width: TABLE_WIDTH,
        height: 2,
        fill: WKND_COLORS.black,
      }),
      ...CHAPTERS.flatMap(createChapter),
    ],
  },
};
