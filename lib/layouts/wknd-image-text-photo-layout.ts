import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutPill,
  createLayoutPlaceholderImage,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridHeight, gridWidth, gridX, gridY } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { SlideElement } from "@/types/presentation";

// Copy in 11 columns on one side, one large photo in the other 12 columns,
// with a column of air between them. The photo stays inside the margins so
// the logo and footer never sit on it.
const TEXT_SPAN = 11;
const PHOTO_SPAN = 12;
const TITLE_SIZE = 80;
const TITLE_LINE_HEIGHT = 0.96;
const TITLE_LINES = 3;
// The title box sits on the lead, so a short title hugs the copy below it.
const TITLE_BOTTOM = 428;
const LEAD_SIZE = 26;
const LEAD_LINE_HEIGHT = 1.35;
const BODY_SIZE = 20;
const BODY_LINE_HEIGHT = 1.55;
const BODY_LINES = 4;
// Konva drops a line that overflows its box by even a fraction.
const boxHeight = (lines: number, size: number, lineHeight: number) =>
  Math.ceil(lines * size * lineHeight) + 2;

const PARAGRAPHS = [
  "We spent two weeks in the stores before we drew anything. The best moments were small: a barista who knew every regular by name, and a queue that moved because people trusted it.",
  "The new identity keeps that warmth and makes it easier to find, from the shopfront to the app.",
] as const;

function createImageSideLayout({
  id,
  name,
  photoSide,
}: {
  id: string;
  name: string;
  photoSide: "left" | "right";
}): SlideLayoutDefinition {
  const textX = gridX(photoSide === "right" ? 1 : PHOTO_SPAN + 2);
  const photoX = gridX(photoSide === "right" ? TEXT_SPAN + 2 : 1);
  const textWidth = gridWidth(TEXT_SPAN);
  const titleHeight = boxHeight(TITLE_LINES, TITLE_SIZE, TITLE_LINE_HEIGHT);
  const leadY = TITLE_BOTTOM + 28;
  const firstParagraphY = leadY + boxHeight(2, LEAD_SIZE, LEAD_LINE_HEIGHT) + 40;
  const paragraphHeight = boxHeight(BODY_LINES, BODY_SIZE, BODY_LINE_HEIGHT);

  const paragraphs: SlideElement[] = PARAGRAPHS.map((text, index) =>
    createLayoutText({
      id: `${id}-paragraph-${index + 1}`,
      text,
      x: textX,
      y: firstParagraphY + index * (paragraphHeight + 24),
      width: textWidth,
      height: paragraphHeight,
      fontSize: BODY_SIZE,
      lineHeight: BODY_LINE_HEIGHT,
      color: WKND_COLORS.muted,
    }),
  );

  return {
    id,
    name,
    category: "image",
    slide: {
      id: `layout-${id}`,
      background: WKND_COLORS.cream,
      elements: [
        createLayoutPlaceholderImage({
          id: `${id}-photo`,
          file: photoSide === "right" ? "img 3.png" : "img 5.png",
          x: photoX,
          y: gridY(1),
          width: gridWidth(PHOTO_SPAN),
          height: gridHeight(12),
          cornerRadius: 24,
        }),
        ...createFrameElements(id),
        ...createLayoutPill({
          id: `${id}-pill`,
          text: "Insight",
          x: textX,
          y: gridY(1),
          width: 120,
          height: 50,
          fontSize: 24,
        }),
        {
          ...createLayoutText({
            id: `${id}-title`,
            text: "Warmth people\ncan find",
            x: textX,
            y: TITLE_BOTTOM - titleHeight,
            width: gridWidth(10),
            height: titleHeight,
            fontSize: TITLE_SIZE,
            fontWeight: 600,
            lineHeight: TITLE_LINE_HEIGHT,
            verticalAlign: "bottom",
          }),
          letterSpacing: -TITLE_SIZE * 0.04,
        },
        createLayoutText({
          id: `${id}-lead`,
          text: "What we learned on the shop floor shaped every decision that followed.",
          x: textX,
          y: leadY,
          width: textWidth,
          height: boxHeight(2, LEAD_SIZE, LEAD_LINE_HEIGHT),
          fontSize: LEAD_SIZE,
          fontWeight: 500,
          lineHeight: LEAD_LINE_HEIGHT,
        }),
        ...paragraphs,
      ],
    },
  };
}

export const WKND_IMAGE_TEXT_PHOTO_LAYOUT = createImageSideLayout({
  id: "wknd-image-text-photo",
  name: "Text + Photo",
  photoSide: "right",
});

export const WKND_IMAGE_PHOTO_TEXT_LAYOUT = createImageSideLayout({
  id: "wknd-image-photo-text",
  name: "Photo + Text",
  photoSide: "left",
});
