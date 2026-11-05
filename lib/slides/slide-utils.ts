import type { Slide } from "@/types/presentation";
import { duplicateElementWithNewId } from "@/lib/elements/duplicate-element";
import { createUniqueId } from "@/lib/id";

export const DEFAULT_SLIDE_BACKGROUND = "#FFFFFF";

export function createSlide(
  background = DEFAULT_SLIDE_BACKGROUND,
): Slide {
  return {
    id: createUniqueId("slide"),
    background,
    elements: [],
  };
}

export function duplicateSlideWithNewIds(slide: Slide): Slide {
  return {
    ...slide,
    id: createUniqueId("slide"),
    elements: slide.elements.map((element) =>
      duplicateElementWithNewId(element, 0),
    ),
  };
}

export function moveSlide<T>(items: T[], oldIndex: number, newIndex: number) {
  if (
    oldIndex === newIndex ||
    oldIndex < 0 ||
    newIndex < 0 ||
    oldIndex >= items.length ||
    newIndex >= items.length
  ) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(oldIndex, 1);

  if (movedItem === undefined) {
    return items;
  }

  nextItems.splice(newIndex, 0, movedItem);
  return nextItems;
}

export function isSolidHexColor(color: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}
