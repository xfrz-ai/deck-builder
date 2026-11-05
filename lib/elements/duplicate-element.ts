import { createUniqueId } from "@/lib/id";
import type { SlideElement } from "@/types/presentation";

export function duplicateElementWithNewId(
  element: SlideElement,
  offset = 20,
): SlideElement {
  return {
    ...element,
    id: createUniqueId("element"),
    x: element.x + offset,
    y: element.y + offset,
  };
}
