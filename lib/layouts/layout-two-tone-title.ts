import { WKND_COLORS } from "@/lib/layouts/layout-elements";
import { createLayoutText } from "@/lib/layouts/layout-text";
import { estimateComponentText } from "@/lib/text/component-text";
import type { TextElement } from "@/types/presentation";

// The rough estimate runs about 8% narrow for semibold Plus Jakarta Sans.
const ESTIMATE_CORRECTION = 1.08;
const BOX_WIDTH = 1000;

// A one-line title with a yellow first part and a white rest, e.g.
// "Lorem" + "Ipsum Dolor". The parts meet at a split point placed from the
// width estimate; each has a wide box aligned towards the split, so an
// estimate error shifts the line slightly but never wraps it.
export function createTwoToneTitle({
  align,
  fontSize,
  highlight,
  id,
  rest,
  x,
  y,
}: {
  // "center" centres the line on `x`; "left" starts it at `x`.
  align: "center" | "left";
  fontSize: number;
  highlight: string;
  id: string;
  rest: string;
  x: number;
  y: number;
}): TextElement[] {
  const spacing = -fontSize * 0.04;
  const gap = fontSize * 0.16;
  const measure = (text: string) =>
    estimateComponentText(text, fontSize, 600, spacing) * ESTIMATE_CORRECTION;
  const split = Math.round(
    align === "center"
      ? x + (measure(highlight) - measure(rest)) / 2
      : x + measure(highlight) + gap / 2,
  );
  const part = (
    partId: string,
    text: string,
    partX: number,
    partAlign: "left" | "right",
    color: string,
  ): TextElement => ({
    ...createLayoutText({
      id: partId,
      text,
      x: Math.round(partX),
      y,
      width: BOX_WIDTH,
      height: fontSize,
      fontSize,
      fontWeight: 600,
      lineHeight: 1,
      align: partAlign,
      color,
    }),
    letterSpacing: spacing,
  });

  return [
    part(`${id}-highlight`, highlight, split - gap / 2 - BOX_WIDTH, "right", WKND_COLORS.yellow),
    part(id, rest, split + gap / 2, "left", WKND_COLORS.white),
  ];
}
