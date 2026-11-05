import type { CardPart, SlideElement } from "@/types/presentation";

export const CARD_PARTS: readonly { label: string; part: CardPart }[] = [
  { part: "background", label: "Background" },
  { part: "image", label: "Image" },
  { part: "icon", label: "Icon" },
  { part: "title", label: "Title" },
  { part: "description", label: "Description" },
];

// Brand colours a card background can use; the first is the default.
export const CARD_BACKGROUND_COLORS: readonly { fill: string; name: string }[] =
  [
    { fill: "#FFFBED", name: "Soft yellow" },
    { fill: "#032ABF", name: "Blue" },
    { fill: "#FBB03A", name: "Yellow" },
    { fill: "#EB3F0A", name: "Red" },
    { fill: "#111111", name: "Black" },
  ];

type ContentPart = Exclude<CardPart, "background">;

// Stacking order of the parts inside the card, top to bottom.
const CONTENT_PARTS: readonly ContentPart[] = [
  "image",
  "icon",
  "title",
  "description",
];

// Space below each part while it is shown, like a Figma auto layout.
const GAP_AFTER: Record<ContentPart, number> = {
  image: 24,
  icon: 20,
  title: 12,
  description: 0,
};

// Inset of the content while the background is shown.
const CARD_PADDING = 24;

export type CardVisibility = Record<CardPart, boolean>;

export interface CardPartUpdate {
  elementId: string;
  updates: {
    fill?: string;
    height: number;
    stroke?: string;
    visible: boolean;
    width: number;
    x: number;
    y: number;
  };
}

export function getCardParts(
  elements: readonly SlideElement[],
  instanceId: string,
) {
  const parts = new Map<CardPart, SlideElement>();

  for (const element of elements) {
    if (element.component?.instanceId === instanceId) {
      parts.set(element.component.part, element);
    }
  }

  return parts;
}

export function getCardVisibility(
  parts: ReadonlyMap<CardPart, SlideElement>,
): CardVisibility {
  const isShown = (part: CardPart) => {
    const element = parts.get(part);
    return element !== undefined && element.visible !== false;
  };

  return {
    background: isShown("background"),
    image: isShown("image"),
    icon: isShown("icon"),
    title: isShown("title"),
    description: isShown("description"),
  };
}

export function getCardBackgroundFill(
  parts: ReadonlyMap<CardPart, SlideElement>,
) {
  const background = parts.get("background");
  return background?.type === "shape" ? background.fill : null;
}

// Cards of one inserted row, in insertion (left-to-right) order.
export function getCardGroupInstanceIds(
  elements: readonly SlideElement[],
  groupId: string,
) {
  const instanceIds: string[] = [];

  for (const element of elements) {
    const component = element.component;

    if (
      component?.groupId === groupId &&
      !instanceIds.includes(component.instanceId)
    ) {
      instanceIds.push(component.instanceId);
    }
  }

  return instanceIds;
}

const isVisible = (element: SlideElement | undefined) =>
  element !== undefined && element.visible !== false;

// Shows or hides parts and restacks the visible ones from where the card
// currently starts, so hiding a part closes the gap. The background keeps the
// card's width: while it is shown, the content is inset by the padding and
// narrowed to fit inside it, and the background grows to the content height.
export function layoutCardParts(
  elements: readonly SlideElement[],
  instanceId: string,
  visibility: CardVisibility,
): CardPartUpdate[] {
  const parts = getCardParts(elements, instanceId);
  const background = parts.get("background");
  const origin = isVisible(background)
    ? background
    : CONTENT_PARTS.map((part) => parts.get(part)).find(isVisible);

  if (!origin) {
    return [];
  }

  const cardWidth =
    background?.width ??
    Math.max(
      ...(["image", "title", "description"] as const).map(
        (part) => parts.get(part)?.width ?? 0,
      ),
    );
  const padding = background && visibility.background ? CARD_PADDING : 0;
  const contentX = origin.x + padding;
  const contentWidth = Math.max(1, cardWidth - padding * 2);
  let cursorY = origin.y + padding;
  let contentBottom = cursorY;
  const updates: CardPartUpdate[] = [];

  for (const part of CONTENT_PARTS) {
    const element = parts.get(part);

    if (!element) {
      continue;
    }

    // The icon keeps its size; everything else spans the content width, and
    // the image keeps its aspect ratio.
    const width = part === "icon" ? element.width : contentWidth;
    const height =
      part === "image"
        ? Math.round(element.height * (width / element.width))
        : element.height;
    const visible = visibility[part];

    updates.push({
      elementId: element.id,
      updates: { height, visible, width, x: contentX, y: cursorY },
    });

    if (visible) {
      contentBottom = cursorY + height;
      cursorY = contentBottom + GAP_AFTER[part];
    }
  }

  if (background) {
    updates.push({
      elementId: background.id,
      updates: {
        height: contentBottom + padding - origin.y,
        visible: visibility.background,
        width: cardWidth,
        x: origin.x,
        y: origin.y,
      },
    });
  }

  return updates;
}

// Hidden parts can't be selected, so once every visible part of a card is
// deleted, its hidden parts are removed too instead of lingering unseen.
export function removeOrphanedCardParts(elements: readonly SlideElement[]) {
  const visibleInstanceIds = new Set(
    elements
      .filter((element) => element.component && element.visible !== false)
      .map((element) => element.component?.instanceId),
  );

  return elements.filter(
    (element) =>
      !element.component ||
      visibleInstanceIds.has(element.component.instanceId),
  );
}
