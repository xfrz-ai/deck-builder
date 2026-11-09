import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutShape,
  createRotatedLayoutObject,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridWidth, gridX } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-questions";
const HEADLINE_SIZE = 176;
const HEADLINE_LINE = 160;
const HEADLINE_TOP = 192;
const HEADLINE_SPACING = -HEADLINE_SIZE * 0.045;
// Where "questions" ends at the headline size, so the accent "?" can follow.
const QUESTION_MARK_X = 824;
const CARD_TOP = 672;
const CARD_HEIGHT = 240;
const CARD_PADDING = 36;
const ICON_SIZE = 78;
// Text on the fixed cream cards sits one step off #111111 so toggling dark
// mode, which swaps #111111 and #FFFFFF, leaves it readable.
const CARD_INK = "#121212";

const STEPS = [
  {
    key: "feedback",
    icon: "3d-stars.png",
    title: "Share your feedback",
    body: "Send us your thoughts on the proposal so we can refine the details.",
  },
  {
    key: "scope",
    icon: "3d-w.png",
    title: "Align on scope",
    body: "We lock the final scope, timeline and team together in one session.",
  },
  {
    key: "kickoff",
    icon: "3d-arrow.png",
    title: "Kick-off",
    body: "Once everything is signed, we start the project and set the first sprint.",
  },
] as const;

function createHeadline(
  id: string,
  text: string,
  x: number,
  y: number,
  width: number,
  color: string,
) {
  return {
    ...createLayoutText({
      id: `${ID}-${id}`,
      text,
      x,
      y,
      width,
      height: HEADLINE_LINE,
      fontSize: HEADLINE_SIZE,
      fontWeight: 600,
      lineHeight: HEADLINE_LINE / HEADLINE_SIZE,
      color,
    }),
    letterSpacing: HEADLINE_SPACING,
  };
}

function createStep(step: (typeof STEPS)[number], index: number): SlideElement[] {
  const id = `${ID}-${step.key}`;
  const x = gridX(1 + index * 8);
  const width = gridWidth(8);
  return [
    createLayoutShape({
      id: `${id}-card`,
      shapeType: "roundedRectangle",
      x,
      y: CARD_TOP,
      width,
      height: CARD_HEIGHT,
      cornerRadius: 28,
      fill: WKND_COLORS.cream,
    }),
    createLayoutObject({
      id: `${id}-icon`,
      file: step.icon,
      size: ICON_SIZE,
      x: x + CARD_PADDING - 4,
      y: CARD_TOP + 32,
    }),
    {
      ...createLayoutText({
        id: `${id}-title`,
        text: step.title,
        x: x + CARD_PADDING + ICON_SIZE + 12,
        y: CARD_TOP + 46,
        width: width - CARD_PADDING * 2 - ICON_SIZE - 6,
        height: 46,
        fontSize: 36,
        fontWeight: 600,
        color: CARD_INK,
      }),
      letterSpacing: -36 * 0.03,
    },
    createLayoutText({
      id: `${id}-body`,
      text: step.body,
      x: x + CARD_PADDING,
      y: CARD_TOP + 142,
      width: width - CARD_PADDING * 2,
      height: 64,
      fontSize: 21,
      lineHeight: 1.4,
      color: WKND_COLORS.muted,
    }),
  ];
}

export const WKND_QUESTIONS_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Any Questions",
  category: "thankyou",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.orange,
    elements: [
      // The black D, tilted so its flat side leans toward the cards.
      createRotatedLayoutObject({
        id: `${ID}-object`,
        file: "3d-d.png",
        size: 860,
        center: { x: 1487, y: 312 },
        rotation: -17,
      }),
      ...createFrameElements(ID),
      {
        ...createHeadline(
          "title",
          "Any\nquestions",
          gridX(1) - 10,
          HEADLINE_TOP,
          gridWidth(12),
          WKND_COLORS.black,
        ),
        height: HEADLINE_LINE * 2,
      },
      {
        ...createHeadline(
          "title-accent",
          "?",
          QUESTION_MARK_X,
          HEADLINE_TOP + HEADLINE_LINE,
          120,
          WKND_COLORS.cream,
        ),
      },
      createLayoutText({
        id: `${ID}-eyebrow`,
        text: "What's next",
        x: gridX(1),
        y: 626,
        width: gridWidth(6),
        height: 30,
        fontSize: 24,
        color: WKND_COLORS.black,
      }),
      ...STEPS.flatMap(createStep),
    ],
  },
};
