"use client";

import {
  CircleGauge,
  ImageUp,
  LoaderCircle,
  Radius,
  Smartphone,
} from "lucide-react";
import { useCallback, useState } from "react";

import { MockupDialog } from "@/components/editor/mockup-dialog";
import { Button } from "@/components/ui/button";
import { useReplaceImage } from "@/hooks/use-replace-image";
import { IMAGE_FILE_ACCEPT } from "@/lib/image/image-file";
import { getMockupDevice } from "@/lib/mockup/mockup-devices";

import { selectActiveSlide, useEditorStore } from "@/store/editor-store";
import type { ImageElement } from "@/types/presentation";

function ReplaceImageButton({
  elementId,
  slideId,
}: {
  elementId: string;
  slideId: string;
}) {
  const { fileInputRef, handleFileChange, isReplacing, openFilePicker } =
    useReplaceImage(slideId, elementId);

  return (
    <>
      <Button
        className="h-8 rounded-lg px-2.5"
        disabled={isReplacing}
        onClick={openFilePicker}
        size="sm"
        variant="ghost"
      >
        {isReplacing ? (
          <LoaderCircle className="size-3.5 animate-spin" strokeWidth={1.8} />
        ) : (
          <ImageUp className="size-3.5" strokeWidth={1.8} />
        )}
        Replace
      </Button>
      <input
        accept={IMAGE_FILE_ACCEPT}
        aria-label="Choose replacement image"
        className="sr-only"
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
    </>
  );
}

// Mockups are flattened images, so the screen is swapped through the
// mockup dialog instead of a plain image replace.
function EditMockupButton({ element }: { element: ImageElement }) {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <Button
        aria-haspopup="dialog"
        className="h-8 rounded-lg px-2.5"
        onClick={() => setIsOpen(true)}
        size="sm"
        variant="ghost"
      >
        <Smartphone className="size-3.5" strokeWidth={1.8} />
        Edit mockup
      </Button>
      {isOpen ? <MockupDialog onClose={close} target={element} /> : null}
    </>
  );
}

export function ImageContextualToolbar() {
  const activeSlide = useEditorStore(selectActiveSlide);
  const selectedElementId = useEditorStore(
    (state) => state.selectedElementIds[0],
  );
  const updateElement = useEditorStore((state) => state.updateElement);
  const element = activeSlide?.elements.find(
    (item) => item.id === selectedElementId,
  );

  if (!activeSlide || element?.type !== "image") {
    return null;
  }

  const update = (updates: Parameters<typeof updateElement>[2]) =>
    updateElement(activeSlide.id, element.id, updates);

  return (
    <div
      aria-label="Image formatting toolbar"
      className="flex items-center gap-2 rounded-2xl border border-stroke-01 bg-surface-01 p-1.5 shadow-toolbar px-3"
      role="toolbar"
    >
      {element.mockup && getMockupDevice(element.mockup.deviceId) ? (
        <EditMockupButton element={element} key={element.id} />
      ) : (
        <ReplaceImageButton
          elementId={element.id}
          key={element.id}
          slideId={activeSlide.id}
        />
      )}

      <div className="h-5 w-px bg-stroke-01" />

      <label className="flex h-8 items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <CircleGauge aria-hidden="true" className="size-3.5" />
        <span>Opacity</span>
        <input
          aria-label="Image opacity"
          className="w-20 accent-primary"
          max={100}
          min={0}
          onChange={(event) =>
            update({ opacity: Number(event.target.value) / 100 })
          }
          type="range"
          value={Math.round(element.opacity * 100)}
        />
        <span className="w-8 text-right tabular-nums">
          {Math.round(element.opacity * 100)}%
        </span>
      </label>

      <div className="h-5 w-px bg-stroke-01" />

      <label className="flex h-8 items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Radius aria-hidden="true" className="size-3.5" />
        <span>Radius</span>
        <input
          aria-label="Image corner radius"
          className="h-8 w-14 rounded-lg border border-stroke-01 bg-surface-03 px-1 text-center text-xs font-semibold tabular-nums text-primary outline-none transition focus:border-stroke-02 focus:bg-surface-02"
          max={1000}
          min={0}
          onChange={(event) => {
            const cornerRadius = Number(event.target.value);

            if (Number.isFinite(cornerRadius) && cornerRadius >= 0) {
              update({ cornerRadius });
            }
          }}
          type="number"
          value={element.cornerRadius}
        />
      </label>
    </div>
  );
}
