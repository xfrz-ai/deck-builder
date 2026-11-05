import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPill,
  createLayoutShape,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import {
  gridHeight,
  gridWidth,
  gridX,
  gridY,
} from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-agenda-overview";
// Three 8-column cards per row, on rows 8–9 and 10–11.
const CARD_COLUMNS = [1, 9, 17] as const;
const CARD_ROWS = [8, 10] as const;
const CARD_WIDTH = gridWidth(8);
const CARD_HEIGHT = gridHeight(2);
const CARD_PADDING = 32;
const CARD_TEXT_OFFSET = 132;
const W_SIZE = 880;

const TOPICS = [
  { title: "Introduction", description: "Who we are and how we work" },
  { title: "Our Team", description: "The people behind the project" },
  { title: "The Brief", description: "Goals, challenges and context" },
  { title: "Our Approach", description: "Strategy and creative direction" },
  { title: "Timeline", description: "A 13-week road to launch" },
  { title: "Next Steps", description: "Investment and how we kick off" },
] as const;

function createTopic(
  topic: (typeof TOPICS)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-topic-${index + 1}`;
  const x = gridX(CARD_COLUMNS[index % CARD_COLUMNS.length]);
  const y = gridY(CARD_ROWS[Math.floor(index / CARD_COLUMNS.length)]);
  const textX = x + CARD_TEXT_OFFSET;
  const textWidth = CARD_WIDTH - CARD_TEXT_OFFSET - CARD_PADDING;

  return [
    createLayoutShape({
      id: `${id}-card`,
      shapeType: "roundedRectangle",
      x,
      y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      cornerRadius: 20,
      fill: WKND_COLORS.cream,
    }),
    {
      ...createLayoutText({
        id: `${id}-number`,
        text: String(index + 1).padStart(2, "0"),
        x: x + CARD_PADDING,
        y,
        width: CARD_TEXT_OFFSET - CARD_PADDING,
        height: CARD_HEIGHT,
        fontSize: 62,
        fontWeight: 600,
        lineHeight: 1,
        verticalAlign: "middle",
        color: WKND_COLORS.blue,
      }),
      letterSpacing: -2,
    },
    {
      ...createLayoutText({
        id: `${id}-title`,
        text: topic.title,
        x: textX,
        y: y + 26,
        width: textWidth,
        height: 40,
        fontSize: 32,
        fontWeight: 600,
      }),
      letterSpacing: -1,
    },
    createLayoutText({
      id: `${id}-description`,
      text: topic.description,
      x: textX,
      y: y + 72,
      width: textWidth,
      height: 26,
      fontSize: 20,
      color: WKND_COLORS.muted,
    }),
  ];
}

export const WKND_AGENDA_OVERVIEW_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "On the Agenda",
  category: "agenda",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      // Cropped by the top-right corner: the lower slab and just the curve
      // of the upper one show.
      createLayoutObject({
        id: `${ID}-object`,
        file: "3d-w.png",
        size: W_SIZE,
        x: 1268,
        y: -290,
      }),
      ...createFrameElements(ID, "light"),
      ...createLayoutPill({
        id: `${ID}-pill`,
        text: "Agenda",
        x: gridX(1),
        y: gridY(1),
        width: 134,
        height: 50,
        fontSize: 24,
        color: WKND_COLORS.white,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "On the\nagenda.",
          x: gridX(1),
          y: 204,
          width: gridWidth(12),
          height: 256,
          fontSize: 132,
          fontWeight: 600,
          lineHeight: 0.94,
          color: WKND_COLORS.white,
        }),
        letterSpacing: -6,
      },
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "Six topics we'll walk through together today.",
        x: gridX(1),
        y: 476,
        width: gridWidth(10),
        height: 32,
        fontSize: 26,
        color: WKND_COLORS.white,
        opacity: 0.8,
      }),
      ...TOPICS.flatMap(createTopic),
    ],
  },
};
