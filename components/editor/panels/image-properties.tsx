"use client";

import { ImageUp, LoaderCircle, Smartphone } from "lucide-react";
import { useCallback, useState } from "react";

import { MockupDialog } from "@/components/editor/mockup-dialog";
import { Button } from "@/components/ui/button";
import { useReplaceImage } from "@/hooks/use-replace-image";
import { IMAGE_FILE_ACCEPT } from "@/lib/image/image-file";
import { getMockupDevice } from "@/lib/mockup/mockup-devices";

import { MIN_ELEMENT_SIZE } from "@/lib/elements/transform-utils";
import { useEditorStore } from "@/store/editor-store";
import type { ImageElement } from "@/types/presentation";

interface ImagePropertiesProps {
  element: ImageElement;
  slideId: string;
}

interface NumericFieldProps {
  label: string;
  max?: number;
  min?: number;
  onCommit: (value: number) => void;
  suffix?: string;
  value: number;
}

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(2)));
}

function NumericField({
  label,
  max,
  min,
  onCommit,
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

    const nextValue = Math.min(
      max ?? Number.POSITIVE_INFINITY,
      Math.max(min ?? Number.NEGATIVE_INFINITY, parsedValue),
    );
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

export function ImageProperties({ element, slideId }: ImagePropertiesProps) {
  const updateElement = useEditorStore((state) => state.updateElement);
  const { fileInputRef, handleFileChange, isReplacing, openFilePicker } =
    useReplaceImage(slideId, element.id);
  const [isMockupOpen, setIsMockupOpen] = useState(false);
  const closeMockup = useCallback(() => setIsMockupOpen(false), []);
  const isMockup = Boolean(
    element.mockup && getMockupDevice(element.mockup.deviceId),
  );
  const update = (updates: Parameters<typeof updateElement>[2]) =>
    updateElement(slideId, element.id, updates);

  return (
    <div className="editor-scrollbar min-h-0 flex-1 overflow-y-auto">
      <Section title="Image">
        <div className="space-y-4">
          {/* A plain replace would flatten the mockup into a straight image. */}
          {isMockup ? (
            <Button
              aria-haspopup="dialog"
              className="w-full"
              onClick={() => setIsMockupOpen(true)}
              variant="outline"
            >
              <Smartphone className="size-4" strokeWidth={1.8} />
              Edit mockup
            </Button>
          ) : (
            <Button
              className="w-full"
              disabled={isReplacing}
              onClick={openFilePicker}
              variant="outline"
            >
              {isReplacing ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  strokeWidth={1.8}
                />
              ) : (
                <ImageUp className="size-4" strokeWidth={1.8} />
              )}
              {isReplacing ? "Replacing…" : "Replace image"}
            </Button>
          )}
          {isMockupOpen ? (
            <MockupDialog onClose={closeMockup} target={element} />
          ) : null}
          <input
            accept={IMAGE_FILE_ACCEPT}
            aria-label="Choose replacement image"
            className="sr-only"
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />
          <label className="block space-y-2 text-[11px] font-medium text-muted-foreground">
            <span className="flex items-center justify-between">
              <span>Opacity</span>
              <span className="tabular-nums text-primary">
                {Math.round(element.opacity * 100)}%
              </span>
            </span>
            <input
              aria-label="Image opacity"
              className="h-1.5 w-full cursor-pointer accent-primary"
              max={100}
              min={0}
              onChange={(event) =>
                update({ opacity: Number(event.target.value) / 100 })
              }
              type="range"
              value={Math.round(element.opacity * 100)}
            />
          </label>

          <label className="block space-y-2 text-[11px] font-medium text-muted-foreground">
            <span className="flex items-center justify-between">
              <span>Corner radius</span>
              <span className="tabular-nums text-primary">
                {Math.round(element.cornerRadius)} px
              </span>
            </span>
            <input
              aria-label="Image corner radius"
              className="h-1.5 w-full cursor-pointer accent-primary"
              max={128}
              min={0}
              onChange={(event) =>
                update({ cornerRadius: Number(event.target.value) })
              }
              type="range"
              value={Math.min(128, Math.max(0, element.cornerRadius))}
            />
          </label>

          <NumericField
            key={`corner-radius-${element.cornerRadius}`}
            label="Radius"
            max={1000}
            min={0}
            onCommit={(cornerRadius) => update({ cornerRadius })}
            suffix="px"
            value={element.cornerRadius}
          />

          {element.originalWidth && element.originalHeight ? (
            <p className="text-[11px] text-muted-foreground">
              Original size: {element.originalWidth} × {element.originalHeight}
            </p>
          ) : null}
        </div>
      </Section>

      <Section title="Position">
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
      </Section>
    </div>
  );
}
