import type { TextElement } from "@/types/presentation";

export const TEXT_FONT_FAMILIES = [
  "Inter",
  "Plus Jakarta Sans",
  "Arial",
  "Georgia",
  "Times New Roman",
] as const satisfies readonly TextElement["fontFamily"][];

export const TEXT_FONT_WEIGHTS = [
  400,
  500,
  600,
  700,
] as const satisfies readonly TextElement["fontWeight"][];

export function getKonvaFontStyle(element: TextElement) {
  const weight = element.fontWeight >= 600 ? "bold" : "normal";
  return element.italic ? `italic ${weight}` : weight;
}

export function getCanvasFontFamily(fontFamily: TextElement["fontFamily"]) {
  if (typeof document === "undefined") {
    return fontFamily;
  }

  const fontVariable =
    fontFamily === "Inter"
      ? "--font-inter"
      : fontFamily === "Plus Jakarta Sans"
        ? "--font-plus-jakarta-sans"
        : null;

  return fontVariable
    ? getComputedStyle(document.documentElement)
        .getPropertyValue(fontVariable)
        .trim() || fontFamily
    : fontFamily;
}
