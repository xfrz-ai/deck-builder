"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { TEXT_FONT_FAMILIES } from "@/lib/text/text-utils";
import { selectActiveSlide, useEditorStore } from "@/store/editor-store";
import type { TextElement } from "@/types/presentation";

export function TextContextualToolbar() {
  const activeSlide = useEditorStore(selectActiveSlide);
  const selectedElementId = useEditorStore(
    (state) => state.selectedElementIds[0],
  );
  const updateElement = useEditorStore((state) => state.updateElement);
  const element = activeSlide?.elements.find(
    (item) => item.id === selectedElementId,
  );

  if (!activeSlide || element?.type !== "text") {
    return null;
  }

  const update = (updates: Parameters<typeof updateElement>[2]) =>
    updateElement(activeSlide.id, element.id, updates);

  return (
    <div
      aria-label="Text formatting toolbar"
      className="flex items-center gap-1 rounded-2xl border border-stroke-01 bg-surface-01 p-1.5 shadow-toolbar"
      role="toolbar"
    >
      <select
        aria-label="Font family"
        className="h-8 w-[104px] rounded-lg border border-stroke-01 bg-surface-03 px-2 text-xs font-medium text-primary outline-none transition hover:border-stroke-02 focus:border-stroke-02 focus:bg-surface-02"
        onChange={(event) =>
          update({
            fontFamily: event.target.value as TextElement["fontFamily"],
          })
        }
        value={element.fontFamily}
      >
        {TEXT_FONT_FAMILIES.map((fontFamily) => (
          <option key={fontFamily} value={fontFamily}>
            {fontFamily}
          </option>
        ))}
      </select>

      <input
        aria-label="Font size"
        className="h-8 w-12 rounded-lg border border-stroke-01 bg-surface-03 px-1 text-center text-xs font-semibold tabular-nums text-primary outline-none transition hover:border-stroke-02 focus:border-stroke-02 focus:bg-surface-02"
        max={300}
        min={8}
        onChange={(event) => {
          const fontSize = Number(event.target.value);

          if (Number.isFinite(fontSize) && fontSize >= 8 && fontSize <= 300) {
            update({ fontSize });
          }
        }}
        type="number"
        value={element.fontSize}
      />

      <div className="mx-0.5 h-5 w-px bg-stroke-01" />

      <Button
        aria-label="Toggle bold"
        aria-pressed={element.fontWeight === 700}
        onClick={() =>
          update({ fontWeight: element.fontWeight === 700 ? 400 : 700 })
        }
        size="icon-sm"
        variant="ghost"
      >
        <Bold className="size-3.5" />
      </Button>
      <Button
        aria-label="Toggle italic"
        aria-pressed={element.italic}
        onClick={() => update({ italic: !element.italic })}
        size="icon-sm"
        variant="ghost"
      >
        <Italic className="size-3.5" />
      </Button>

      <label className="flex size-8 cursor-pointer items-center justify-center rounded-lg transition hover:bg-surface-03">
        <span
          aria-hidden="true"
          className="size-4 rounded-full border border-black/10"
          style={{ backgroundColor: element.color }}
        />
        <span className="sr-only">Text color</span>
        <input
          aria-label="Text color"
          className="sr-only"
          onChange={(event) => update({ color: event.target.value })}
          type="color"
          value={element.color}
        />
      </label>

      <div className="mx-0.5 h-5 w-px bg-stroke-01" />

      {(
        [
          ["left", AlignLeft],
          ["center", AlignCenter],
          ["right", AlignRight],
        ] as const
      ).map(([alignment, Icon]) => (
        <Button
          aria-label={`Align ${alignment}`}
          aria-pressed={element.align === alignment}
          key={alignment}
          onClick={() => update({ align: alignment })}
          size="icon-sm"
          variant="ghost"
        >
          <Icon className="size-3.5" />
        </Button>
      ))}
    </div>
  );
}
