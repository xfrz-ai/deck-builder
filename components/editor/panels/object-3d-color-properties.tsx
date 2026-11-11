"use client";

import { Check } from "lucide-react";

import {
  get3dObjectSrc,
  parse3dObjectSrc,
  WKND_3D_COLORS,
  WKND_3D_SWATCHES,
  type Wknd3dColor,
} from "@/lib/themes/deck-themes";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor-store";
import type { SlideElement } from "@/types/presentation";

const COLOR_NAMES: Record<Wknd3dColor, string> = {
  black: "Black",
  blue: "Blue",
  orange: "Orange",
  white: "White",
  yellow: "Yellow",
};

// Elements regenerated from a form (agenda, team, timeline, table, text
// block) cannot be edited directly, so a recolor would not stick.
export function canRecolor3dObject(element: SlideElement | undefined) {
  return Boolean(
    element?.type === "image" &&
      parse3dObjectSrc(element.src) &&
      !element.agendaId &&
      !element.teamId &&
      !element.timelineId &&
      !element.tableId &&
      !element.textBlockId,
  );
}

// Swaps a WKND 3D object for the same object rendered in another color.
// Only this element on this slide changes.
export function Object3dColorProperties({
  element,
  slideId,
}: {
  element: SlideElement;
  slideId: string;
}) {
  const updateElement = useEditorStore((state) => state.updateElement);
  const parsed = element.type === "image" ? parse3dObjectSrc(element.src) : null;

  if (!parsed) return null;

  return (
    <section className="shrink-0 border-b border-stroke-01">
      <h3 className="flex min-h-12 items-center justify-between px-4 py-3 text-xs font-semibold text-primary">
        3D color
        <span className="text-[11px] font-medium text-muted-foreground">
          {COLOR_NAMES[parsed.color]}
        </span>
      </h3>
      <div className="flex gap-2 px-4 pb-4" role="radiogroup" aria-label="3D object color">
        {WKND_3D_COLORS.map((color) => {
          const isActive = color === parsed.color;

          return (
            <button
              aria-checked={isActive}
              aria-label={COLOR_NAMES[color]}
              className={cn(
                "flex size-8 cursor-pointer items-center justify-center rounded-full ring-1 ring-inset ring-black/10 transition-shadow",
                isActive
                  ? "shadow-[0_0_0_2px_var(--color-surface-01),0_0_0_3.5px_#7b7b7b]"
                  : "hover:shadow-[0_0_0_2px_var(--color-surface-01),0_0_0_3.5px_#d4d4d4]",
              )}
              key={color}
              onClick={() =>
                updateElement(slideId, element.id, {
                  src: get3dObjectSrc(parsed.object, color),
                })
              }
              role="radio"
              style={{ background: WKND_3D_SWATCHES[color] }}
              title={COLOR_NAMES[color]}
              type="button"
            >
              {isActive ? (
                <Check
                  className={cn(
                    "size-3.5",
                    color === "white" || color === "yellow"
                      ? "text-[#111111]"
                      : "text-white",
                  )}
                  strokeWidth={2.6}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
