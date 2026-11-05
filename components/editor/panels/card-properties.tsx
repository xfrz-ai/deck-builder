"use client";

import { Button } from "@/components/ui/button";
import { SwitchIndicator } from "@/components/ui/switch";
import {
  CARD_BACKGROUND_COLORS,
  CARD_PARTS,
  type CardPartUpdate,
  type CardVisibility,
  getCardBackgroundFill,
  getCardGroupInstanceIds,
  getCardParts,
  getCardVisibility,
  layoutCardParts,
} from "@/lib/elements/card-component";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor-store";
import type { CardPart, ComponentPart, Slide } from "@/types/presentation";

function isSameVisibility(a: CardVisibility, b: CardVisibility) {
  return CARD_PARTS.every(({ part }) => a[part] === b[part]);
}

interface CardPropertiesProps {
  // The component data of the primary selected element.
  component: ComponentPart;
  selectedElementIds: readonly string[];
  slide: Slide;
}

// Figma-style boolean properties. Toggles apply to every selected card, like
// changing a property with several instances selected.
export function CardProperties({
  component,
  selectedElementIds,
  slide,
}: CardPropertiesProps) {
  const updateElements = useEditorStore((state) => state.updateElements);
  const selectElements = useEditorStore((state) => state.selectElements);
  const { elements } = slide;
  const selectedCardIds = [
    ...new Set(
      selectedElementIds.flatMap((elementId) => {
        const instanceId = elements.find((element) => element.id === elementId)
          ?.component?.instanceId;
        return instanceId ? [instanceId] : [];
      }),
    ),
  ];
  const cardVisibility = new Map(
    selectedCardIds.map((instanceId) => [
      instanceId,
      getCardVisibility(getCardParts(elements, instanceId)),
    ]),
  );
  const parts = getCardParts(elements, component.instanceId);
  const visibility = getCardVisibility(parts);
  const backgroundFill = getCardBackgroundFill(parts);
  const rowCardIds = getCardGroupInstanceIds(elements, component.groupId);
  const cardNumber = rowCardIds.indexOf(component.instanceId) + 1;
  const isRowInSync = rowCardIds.every((instanceId) => {
    const cardParts = getCardParts(elements, instanceId);

    return (
      isSameVisibility(getCardVisibility(cardParts), visibility) &&
      (backgroundFill === null ||
        getCardBackgroundFill(cardParts) === backgroundFill)
    );
  });

  // A card always keeps one visible part, or it could no longer be selected.
  const canHide = (part: CardPart) =>
    [...cardVisibility.values()].every((cardParts) =>
      CARD_PARTS.some((item) => item.part !== part && cardParts[item.part]),
    );

  const applyUpdates = (updates: CardPartUpdate[]) => {
    updateElements(slide.id, updates);

    // Hidden elements can't stay selected; fall back to a visible part.
    const hiddenIds = new Set(
      updates
        .filter(({ updates: next }) => !next.visible)
        .map(({ elementId }) => elementId),
    );
    const remaining = selectedElementIds.filter((id) => !hiddenIds.has(id));
    const fallback = updates.find(
      ({ elementId, updates: next }) =>
        next.visible && parts.get(component.part)?.id !== elementId,
    );

    if (remaining.length !== selectedElementIds.length) {
      selectElements(
        remaining.length > 0 ? remaining : fallback ? [fallback.elementId] : [],
      );
    }
  };

  const togglePart = (part: CardPart) => {
    const nextValue = !visibility[part];

    applyUpdates(
      selectedCardIds.flatMap((instanceId) =>
        layoutCardParts(elements, instanceId, {
          ...(cardVisibility.get(instanceId) ?? visibility),
          [part]: nextValue,
        }),
      ),
    );
  };

  // Copies this card's toggles and background colour to its whole row.
  const applyToRow = () =>
    applyUpdates(
      rowCardIds.flatMap((instanceId) => {
        const backgroundId = getCardParts(elements, instanceId).get(
          "background",
        )?.id;

        return layoutCardParts(elements, instanceId, visibility).map(
          (update) =>
            backgroundFill && update.elementId === backgroundId
              ? {
                  ...update,
                  updates: {
                    ...update.updates,
                    fill: backgroundFill,
                    stroke: backgroundFill,
                  },
                }
              : update,
        );
      }),
    );

  const setBackgroundFill = (fill: string) =>
    updateElements(
      slide.id,
      selectedCardIds.flatMap((instanceId) => {
        const background = getCardParts(elements, instanceId).get("background");

        return background
          ? [{ elementId: background.id, updates: { fill, stroke: fill } }]
          : [];
      }),
    );

  return (
    <section className="shrink-0 border-b border-stroke-01">
      <h3 className="flex min-h-12 items-center justify-between px-4 py-3 text-xs font-semibold text-primary">
        Card
        {selectedCardIds.length > 1 ? (
          <span className="font-medium text-muted-foreground">
            {selectedCardIds.length} cards selected
          </span>
        ) : rowCardIds.length > 1 ? (
          <span className="font-medium text-muted-foreground">
            {cardNumber} of {rowCardIds.length}
          </span>
        ) : null}
      </h3>
      <div className="px-4 pb-4">
        <div className="-mx-2">
          {CARD_PARTS.map(({ label, part }) => {
            const checked = visibility[part];

            return (
              <button
                aria-checked={checked}
                className="flex h-9 w-full cursor-pointer items-center justify-between rounded-lg px-2 text-xs font-medium text-primary outline-none transition hover:bg-surface-03 focus-visible:ring-2 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-40"
                disabled={!parts.has(part) || (checked && !canHide(part))}
                key={part}
                onClick={() => togglePart(part)}
                role="switch"
                type="button"
              >
                {label}
                <SwitchIndicator checked={checked} />
              </button>
            );
          })}
        </div>
        {visibility.background && backgroundFill ? (
          <div className="mt-3 space-y-1.5 text-[11px] font-medium text-muted-foreground">
            <span>Background color</span>
            <div
              aria-label="Card background color"
              className="flex gap-2"
              role="group"
            >
              {CARD_BACKGROUND_COLORS.map(({ fill, name }) => {
                const isSelected =
                  fill.toLowerCase() === backgroundFill.toLowerCase();

                return (
                  <button
                    aria-label={name}
                    aria-pressed={isSelected}
                    className={cn(
                      "size-8 cursor-pointer rounded-lg border border-[#323232]/10 outline-none transition focus-visible:ring-2 focus-visible:ring-ring/35",
                      isSelected &&
                        "ring-2 ring-primary ring-offset-2 ring-offset-surface-01",
                    )}
                    key={fill}
                    onClick={() => setBackgroundFill(fill)}
                    style={{ backgroundColor: fill }}
                    title={name}
                    type="button"
                  />
                );
              })}
            </div>
          </div>
        ) : null}
        {rowCardIds.length > 1 ? (
          <Button
            className="mt-3 w-full"
            disabled={isRowInSync}
            onClick={applyToRow}
            size="sm"
            variant="outline"
          >
            {isRowInSync
              ? `All ${rowCardIds.length} cards match`
              : `Apply to all ${rowCardIds.length} cards`}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
