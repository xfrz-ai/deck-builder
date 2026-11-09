"use client";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Underline,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MIN_ELEMENT_SIZE } from "@/lib/elements/transform-utils";
import {
  TEXT_FONT_FAMILIES,
  TEXT_FONT_WEIGHTS,
} from "@/lib/text/text-utils";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor-store";
import type { TextElement } from "@/types/presentation";

interface TextPropertiesProps {
  element: TextElement;
  slideId: string;
  hideLayoutControls?: boolean;
}

interface NumericFieldProps {
  label: string;
  max?: number;
  min?: number;
  onCommit: (value: number) => void;
  step?: number;
  suffix?: string;
  value: number;
}

function clamp(value: number, min?: number, max?: number) {
  return Math.min(
    max ?? Number.POSITIVE_INFINITY,
    Math.max(min ?? Number.NEGATIVE_INFINITY, value),
  );
}

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(2)));
}

export function NumericField({
  label,
  max,
  min,
  onCommit,
  step = 1,
  suffix,
  value,
}: NumericFieldProps) {
  const [draftValue, setDraftValue] = useState(formatNumber(value));

  const commit = () => {
    const parsedValue = Number(draftValue);

    if (!Number.isFinite(parsedValue)) {
      setDraftValue(formatNumber(value));
      return;
    }

    const nextValue = clamp(parsedValue, min, max);
    setDraftValue(formatNumber(nextValue));
    onCommit(nextValue);
  };

  return (
    <label className="space-y-1.5 text-[11px] font-medium text-muted-foreground">
      <span>{label}</span>
      <span className="flex h-9 items-center rounded-[10px] border border-surface-03 bg-surface-03 px-2.5 transition-colors focus-within:border-stroke-02 focus-within:bg-surface-02">
        <input
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent text-xs font-medium tabular-nums text-primary outline-none"
          inputMode="decimal"
          onBlur={commit}
          onChange={(event) => setDraftValue(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          step={step}
          type="number"
          value={draftValue}
        />
        {suffix ? (
          <span className="ml-1 text-[11px] text-muted-foreground/70">{suffix}</span>
        ) : null}
      </span>
    </label>
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="border-t border-stroke-01 first:border-t-0">
      <h3 className="flex min-h-12 items-center px-4 py-3 text-xs font-semibold text-primary">
        {title}
      </h3>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

const segmentButtonClassName =
  "aria-pressed:border-transparent aria-pressed:bg-surface-01 aria-pressed:shadow-[0_1.25px_3px_0_rgba(50,50,50,0.10),inset_0_1.25px_1px_0_#FFF]";

const inputClassName =
  "h-9 w-full rounded-[10px] border border-surface-03 bg-surface-03 px-2 text-xs font-medium text-primary outline-none transition-colors focus:border-stroke-02 focus:bg-surface-02";

export function TextProperties({ element, slideId, hideLayoutControls = false }: TextPropertiesProps) {
  const updateElement = useEditorStore((state) => state.updateElement);
  const update = (updates: Parameters<typeof updateElement>[2]) =>
    updateElement(slideId, element.id, updates);

  return (
    <div className="editor-scrollbar min-h-0 flex-1 overflow-y-auto">
      <Section title="Text">
        <div className="space-y-3">
          <label className="block space-y-1.5 text-[11px] font-medium text-muted-foreground">
            <span>Font family</span>
            <select
              aria-label="Font family"
              className={inputClassName}
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
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <NumericField
              key={`font-size-${element.fontSize}`}
              label="Font size"
              max={300}
              min={8}
              onCommit={(fontSize) => update({ fontSize })}
              value={element.fontSize}
            />
            <label className="space-y-1.5 text-[11px] font-medium text-muted-foreground">
              <span>Weight</span>
              <select
                aria-label="Font weight"
                className={inputClassName}
                onChange={(event) =>
                  update({
                    fontWeight: Number(
                      event.target.value,
                    ) as TextElement["fontWeight"],
                  })
                }
                value={element.fontWeight}
              >
                {TEXT_FONT_WEIGHTS.map((weight) => (
                  <option key={weight} value={weight}>
                    {weight === 400
                      ? "Regular"
                      : weight === 500
                        ? "Medium"
                        : weight === 600
                          ? "Semibold"
                          : "Bold"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex gap-1 rounded-xl border border-stroke-02 bg-surface-03 p-[3px] shadow-[inset_0_1px_2px_0_rgba(50,50,50,0.10)]">
            <Button
              aria-label="Toggle bold"
              aria-pressed={element.fontWeight === 700}
              className={cn("flex-1", segmentButtonClassName)}
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
              className={cn("flex-1", segmentButtonClassName)}
              onClick={() => update({ italic: !element.italic })}
              size="icon-sm"
              variant="ghost"
            >
              <Italic className="size-3.5" />
            </Button>
            <Button
              aria-label="Toggle underline"
              aria-pressed={element.textDecoration === "underline"}
              className={cn("flex-1", segmentButtonClassName)}
              onClick={() =>
                update({
                  textDecoration:
                    element.textDecoration === "underline"
                      ? "none"
                      : "underline",
                })
              }
              size="icon-sm"
              variant="ghost"
            >
              <Underline className="size-3.5" />
            </Button>
          </div>

          <label className="block space-y-1.5 text-[11px] font-medium text-muted-foreground">
            <span>Text color</span>
            <span className="flex h-9 items-center gap-2 rounded-[10px] bg-surface-03 p-1 pr-2.5">
              <input
                aria-label="Text color"
                className="size-7 cursor-pointer overflow-hidden rounded-md border border-[#323232]/10 bg-transparent p-0 [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0"
                onChange={(event) => update({ color: event.target.value })}
                type="color"
                value={element.color}
              />
              <span className="text-xs font-medium uppercase tabular-nums text-primary">
                {element.color}
              </span>
            </span>
          </label>

          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              Alignment
            </span>
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-stroke-02 bg-surface-03 p-[3px] shadow-[inset_0_1px_2px_0_rgba(50,50,50,0.10)]">
              {(
                [
                  ["left", AlignLeft],
                  ["center", AlignCenter],
                  ["right", AlignRight],
                  ["justify", AlignJustify],
                ] as const
              ).map(([alignment, Icon]) => (
                <Button
                  aria-label={`Align ${alignment}`}
                  aria-pressed={element.align === alignment}
                  className={segmentButtonClassName}
                  key={alignment}
                  onClick={() => update({ align: alignment })}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Icon className="size-3.5" />
                </Button>
              ))}
            </div>
          </div>

          {!hideLayoutControls ? <label className="block space-y-1.5 text-[11px] font-medium text-muted-foreground">
            <span>Vertical alignment</span>
            <select
              aria-label="Vertical alignment"
              className={inputClassName}
              onChange={(event) =>
                update({
                  verticalAlign: event.target
                    .value as TextElement["verticalAlign"],
                })
              }
              value={element.verticalAlign}
            >
              <option value="top">Top</option>
              <option value="middle">Middle</option>
              <option value="bottom">Bottom</option>
            </select>
          </label> : null}
        </div>
      </Section>

      <Section title="Spacing">
        <div className="grid grid-cols-2 gap-2.5">
          <NumericField
            key={`line-height-${element.lineHeight}`}
            label="Line height"
            max={4}
            min={0.5}
            onCommit={(lineHeight) => update({ lineHeight })}
            step={0.1}
            value={element.lineHeight}
          />
          <NumericField
            key={`letter-spacing-${element.letterSpacing}`}
            label="Letter spacing"
            max={200}
            min={-100}
            onCommit={(letterSpacing) => update({ letterSpacing })}
            step={0.5}
            value={element.letterSpacing}
          />
        </div>
      </Section>

      <Section title="Appearance">
        <NumericField
          key={`opacity-${element.opacity}`}
          label="Opacity"
          max={100}
          min={0}
          onCommit={(opacity) => update({ opacity: opacity / 100 })}
          suffix="%"
          value={element.opacity * 100}
        />
      </Section>

      {!hideLayoutControls ? <Section title="Position">
        <div className="grid grid-cols-2 gap-2.5">
          <NumericField
            key={`x-${element.x}`}
            label="X"
            onCommit={(x) => update({ x })}
            value={element.x}
          />
          <NumericField
            key={`y-${element.y}`}
            label="Y"
            onCommit={(y) => update({ y })}
            value={element.y}
          />
          <NumericField
            key={`width-${element.width}`}
            label="Width"
            min={MIN_ELEMENT_SIZE}
            onCommit={(width) => update({ width })}
            value={element.width}
          />
          <NumericField
            key={`height-${element.height}`}
            label="Height"
            min={MIN_ELEMENT_SIZE}
            onCommit={(height) => update({ height })}
            value={element.height}
          />
          <NumericField
            key={`rotation-${element.rotation}`}
            label="Rotation"
            onCommit={(rotation) => update({ rotation })}
            suffix="°"
            value={element.rotation}
          />
        </div>
      </Section> : null}
    </div>
  );
}
