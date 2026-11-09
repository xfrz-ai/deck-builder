import type { TextElement } from "@/types/presentation";

export type MeasureComponentText = (
  text: string,
  size: number,
  weight?: number,
  spacing?: number,
) => number;

export const estimateComponentText: MeasureComponentText = (text, size, weight = 400, spacing = 0) => {
  const characters = Array.from(text);
  const weightFactor = weight >= 600 ? 1.02 : 1;
  const width = characters.reduce((total, character) => {
    const ratio = /\s/.test(character) ? 0.28 : /[ilI.,'!:;]/.test(character) ? 0.26 : /[MW@]/.test(character) ? 0.85 : 0.55;
    return total + size * ratio * weightFactor;
  }, 0);
  return width + Math.max(0, characters.length - 1) * spacing;
};

export function componentTextFits(element: TextElement, measure: MeasureComponentText, maxLines?: number) {
  const width = (text: string) => measure(text, element.fontSize, element.fontWeight, element.letterSpacing);
  let lineCount = 0;
  for (const paragraph of element.text.split("\n")) {
    let line = "";
    lineCount++;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (width(word) > element.width) return false;
      const next = line ? `${line} ${word}` : word;
      if (line && width(next) > element.width) {
        lineCount++;
        line = word;
      } else {
        line = next;
      }
    }
  }
  const capacity = Math.floor((element.height + 0.5) / (element.fontSize * element.lineHeight));
  return lineCount <= Math.min(maxLines ?? capacity, capacity);
}
