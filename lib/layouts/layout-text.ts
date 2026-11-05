import { gridX } from "@/lib/layouts/layout-grid";
import type { TextElement } from "@/types/presentation";

const FONT_FAMILY = "Plus Jakarta Sans";
const TEXT_COLOR = "#111111";

export interface LayoutTextOptions {
  align?: TextElement["align"];
  color?: string;
  fontSize: number;
  fontWeight?: number;
  height: number;
  id: string;
  lineHeight?: number;
  opacity?: number;
  text: string;
  verticalAlign?: TextElement["verticalAlign"];
  width: number;
  x: number;
  y: number;
}

export function createLayoutText({
  align = "left",
  color = TEXT_COLOR,
  fontSize,
  fontWeight = 400,
  height,
  id,
  lineHeight = 1.2,
  opacity = 1,
  text,
  verticalAlign = "top",
  width,
  x,
  y,
}: LayoutTextOptions): TextElement {
  return {
    id,
    type: "text",
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity,
    locked: false,
    visible: true,
    text,
    fontFamily: FONT_FAMILY,
    fontSize,
    fontWeight,
    italic: false,
    color,
    align,
    verticalAlign,
    lineHeight,
    letterSpacing: 0,
    textDecoration: "none",
    padding: 0,
  };
}

// Slide title style shared by every WKND layout.
export function createLayoutTitle({
  color,
  height,
  id,
  text,
}: Pick<LayoutTextOptions, "color" | "height" | "id" | "text">): TextElement {
  return createLayoutText({
    id,
    text,
    x: gridX(1),
    y: 126,
    width: 680,
    height,
    fontSize: 72,
    lineHeight: 1.26,
    color,
  });
}
