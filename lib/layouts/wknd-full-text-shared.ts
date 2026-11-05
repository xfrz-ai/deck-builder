import { createLayoutPill } from "@/lib/layouts/layout-elements";
import { gridWidth, gridX, gridY } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { SlideElement } from "@/types/presentation";

const TITLE_SIZE = 72;

// Eyebrow pill, one-line title and two-line subtitle shared by the Full Text
// layouts.
export function createFullTextHeader({
  color,
  id,
  subtitleColor = color,
  subtitleOpacity = 1,
}: {
  color: string;
  id: string;
  subtitleColor?: string;
  subtitleOpacity?: number;
}): SlideElement[] {
  return [
    ...createLayoutPill({
      id: `${id}-pill`,
      text: "Design Systems",
      x: gridX(1),
      y: gridY(1),
      width: 222,
      height: 50,
      fontSize: 24,
      color,
    }),
    {
      ...createLayoutText({
        id: `${id}-title`,
        text: "Write title here",
        x: gridX(1),
        y: gridY(2),
        width: gridWidth(16),
        height: 80,
        fontSize: TITLE_SIZE,
        fontWeight: 600,
        lineHeight: 1.1,
        color,
      }),
      letterSpacing: -TITLE_SIZE * 0.04,
    },
    createLayoutText({
      id: `${id}-subtitle`,
      text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.",
      x: gridX(1),
      y: 288,
      width: gridWidth(13),
      height: 68,
      fontSize: 24,
      lineHeight: 1.4,
      color: subtitleColor,
      opacity: subtitleOpacity,
    }),
  ];
}
