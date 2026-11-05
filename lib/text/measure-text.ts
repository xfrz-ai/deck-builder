import { getCanvasFontFamily } from "@/lib/text/text-utils";
import type { TextElement } from "@/types/presentation";

let measureContext: CanvasRenderingContext2D | null = null;

function getMeasureContext() {
  if (!measureContext && typeof document !== "undefined") {
    measureContext = document.createElement("canvas").getContext("2d");
  }

  return measureContext;
}

export function getCanvasFont(
  fontFamily: TextElement["fontFamily"],
  fontSize: number,
  fontWeight = 400,
) {
  return `${fontWeight} ${fontSize}px ${getCanvasFontFamily(fontFamily)}`;
}

// Single-line width in logical pixels, or null outside the browser.
export function measureTextWidth(
  text: string,
  fontFamily: TextElement["fontFamily"],
  fontSize: number,
  fontWeight = 400,
) {
  const context = getMeasureContext();

  if (!context) {
    return null;
  }

  context.font = getCanvasFont(fontFamily, fontSize, fontWeight);
  return context.measureText(text).width;
}
