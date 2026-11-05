import { createUniqueId } from "@/lib/id";
import type { SlideElement } from "@/types/presentation";

// Each repeated paste onto the same slide shifts by this much.
export const PASTE_OFFSET = 20;

// Returns what a copy should hold, in slide (z-)order. A card whose visible
// parts are all selected is copied whole, hidden parts included, so its
// toggles still work after pasting; a lone part of a card is copied as a
// plain element.
export function collectElementsToCopy(
  elements: readonly SlideElement[],
  selectedIds: readonly string[],
): SlideElement[] {
  const selected = new Set(selectedIds);
  const isWholeCardSelected = (instanceId: string) =>
    elements.every(
      (element) =>
        element.component?.instanceId !== instanceId ||
        element.visible === false ||
        selected.has(element.id),
    );

  return elements.flatMap((element) => {
    if (!element.component) {
      return selected.has(element.id) ? [element] : [];
    }

    if (isWholeCardSelected(element.component.instanceId)) {
      return selected.has(element.id) || element.visible === false
        ? [element]
        : [];
    }

    return selected.has(element.id)
      ? [{ ...element, component: undefined }]
      : [];
  });
}

// Plain text of the copied elements, for pasting into other apps.
export function getClipboardText(elements: readonly SlideElement[]) {
  return elements
    .flatMap((element) => (element.type === "text" ? [element.text] : []))
    .join("\n");
}

// Fresh element ids and fresh card ids, so a pasted card is independent of
// the original, shifted by `offset`.
export function cloneElementsForPaste(
  elements: readonly SlideElement[],
  offset: number,
): SlideElement[] {
  const componentIds = new Map<string, string>();
  const remap = (id: string) => {
    const existing = componentIds.get(id);

    if (existing) {
      return existing;
    }

    const next = createUniqueId("component");
    componentIds.set(id, next);
    return next;
  };

  return elements.map((element) => ({
    ...element,
    id: createUniqueId("element"),
    x: element.x + offset,
    y: element.y + offset,
    component: element.component && {
      ...element.component,
      instanceId: remap(element.component.instanceId),
      groupId: remap(element.component.groupId),
    },
  }));
}
