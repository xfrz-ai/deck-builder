import type { SlideElement } from "@/types/presentation";

const DARK_TEXT_COLORS = new Set(["#111111", "#000000"]);
const LIGHT_MODE_TEXT_COLOR = "#111111";
const DARK_MODE_TEXT_COLOR = "#FFFFFF";

function swapColor(color: string, darkMode: boolean) {
  const normalized = color.toUpperCase();

  if (darkMode && DARK_TEXT_COLORS.has(normalized)) {
    return DARK_MODE_TEXT_COLOR;
  }

  if (!darkMode && normalized === DARK_MODE_TEXT_COLOR) {
    return LIGHT_MODE_TEXT_COLOR;
  }

  return color;
}

export function applyDarkModeToElement(
  element: SlideElement,
  darkMode: boolean,
): SlideElement {
  if (element.type === "text") {
    const color = swapColor(element.color, darkMode);
    return color === element.color ? element : { ...element, color };
  }

  // The footer divider is the only background shape and follows the text color.
  if (element.type === "shape" && element.role === "background") {
    const fill = swapColor(element.fill, darkMode);
    const stroke = swapColor(element.stroke, darkMode);
    return fill === element.fill && stroke === element.stroke
      ? element
      : { ...element, fill, stroke };
  }

  return element;
}
