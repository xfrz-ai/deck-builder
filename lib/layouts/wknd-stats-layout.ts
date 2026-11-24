import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutShape,
  createRotatedLayoutObject,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridWidth, gridX, gridY } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import { createFullTextHeader } from "@/lib/layouts/wknd-full-text-shared";
import { get3dObjectSrc } from "@/lib/themes/deck-themes";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-stats";
// Four 6-column figures from row 7, under the shared Full Text header. With
// fewer figures the deck spec spreads them over the full width.
const STAT_SPAN = 6;
const STAT_TOP = gridY(7);
const VALUE_SIZE = 120;
const VALUE_Y = STAT_TOP + 32;
const LABEL_SIZE = 24;
const LABEL_Y = VALUE_Y + VALUE_SIZE + 22;
const BODY_SIZE = 20;
const BODY_LINE_HEIGHT = 1.5;
const BODY_LINES = 3;
const BODY_Y = LABEL_Y + 48;

const STATS = [
  {
    value: "38%",
    label: "More repeat visits",
    body: "Members came back more often in the six months after the loyalty app launched.",
  },
  {
    value: "2.4×",
    label: "Faster checkout",
    body: "Ordering ahead cut the average wait at the counter during the morning rush.",
  },
  {
    value: "120",
    label: "Stores live",
    body: "Rolled out in three waves, with no downtime for the shops.",
  },
  {
    value: "4.8",
    label: "App store rating",
    body: "From more than 9,000 reviews in the first year.",
  },
] as const;

function createStat(
  stat: (typeof STATS)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-stat-${index + 1}`;
  const x = gridX(1 + index * STAT_SPAN);
  const width = gridWidth(STAT_SPAN);

  return [
    {
      ...createLayoutShape({
        id: `${id}-divider`,
        shapeType: "rectangle",
        x,
        y: STAT_TOP,
        width,
        height: 1,
        fill: WKND_COLORS.black,
      }),
      opacity: 0.35,
    },
    {
      ...createLayoutText({
        id: `${id}-value`,
        text: stat.value,
        x,
        y: VALUE_Y,
        width,
        height: VALUE_SIZE + 2,
        fontSize: VALUE_SIZE,
        fontWeight: 600,
        lineHeight: 1,
        color: WKND_COLORS.blue,
      }),
      letterSpacing: -VALUE_SIZE * 0.04,
    },
    createLayoutText({
      id: `${id}-label`,
      text: stat.label,
      x,
      y: LABEL_Y,
      width,
      height: Math.ceil(LABEL_SIZE * 1.3) + 2,
      fontSize: LABEL_SIZE,
      fontWeight: 600,
      lineHeight: 1.3,
    }),
    createLayoutText({
      id: `${id}-body`,
      text: stat.body,
      x,
      y: BODY_Y,
      width,
      // Konva drops a line that overflows its box by even a fraction.
      height: Math.ceil(BODY_LINES * BODY_SIZE * BODY_LINE_HEIGHT) + 2,
      fontSize: BODY_SIZE,
      lineHeight: BODY_LINE_HEIGHT,
      color: WKND_COLORS.muted,
    }),
  ];
}

export const WKND_STATS_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Key Numbers",
  category: "stats",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.cream,
    elements: [
      // Blue arrow in the top-right corner, clear of the title and the
      // figures; it matches the figures, where the white one fades on cream.
      {
        ...createRotatedLayoutObject({
          id: `${ID}-object`,
          file: "3d-arrow.png",
          size: 440,
          center: { x: 1640, y: 270 },
          rotation: -8,
        }),
        src: get3dObjectSrc("arrow", "blue"),
      },
      ...createFrameElements(ID),
      ...createFullTextHeader({ id: ID, color: WKND_COLORS.black }),
      ...STATS.flatMap(createStat),
    ],
  },
};
