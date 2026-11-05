"use client";

import { ImageUp } from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  GENERATOR_PREVIEW_BACKGROUND,
  GeneratorDialog,
} from "@/components/editor/generator-dialog";
import { Button } from "@/components/ui/button";
import { createImageElement } from "@/lib/elements/create-image-element";
import {
  IMAGE_FILE_ACCEPT,
  type LoadedImageFile,
  loadImageFile,
} from "@/lib/image/image-file";
import {
  getMockupDevice,
  MOCKUP_DEVICES,
  type MockupDevice,
} from "@/lib/mockup/mockup-devices";
import { type RenderedMockup, renderMockup } from "@/lib/mockup/render-mockup";
import { cn } from "@/lib/utils";
import { selectActiveSlide, useEditorStore } from "@/store/editor-store";
import type { ImageElement, Slide } from "@/types/presentation";

interface Screenshot extends LoadedImageFile {
  name: string;
}

interface RenderState {
  device: MockupDevice;
  error?: string;
  result?: RenderedMockup;
  screenshot: Screenshot;
}

function createMockupElement(
  device: MockupDevice,
  mockup: RenderedMockup,
): ImageElement {
  return {
    ...createImageElement({
      src: mockup.src,
      originalWidth: mockup.width,
      originalHeight: mockup.height,
    }),
    mockup: { deviceId: device.id },
  };
}

// Keeps position and width; height follows the (possibly new) frame ratio.
function getMockupUpdates(
  element: ImageElement,
  device: MockupDevice,
  mockup: RenderedMockup,
) {
  return {
    src: mockup.src,
    originalWidth: mockup.width,
    originalHeight: mockup.height,
    height: element.width * (mockup.height / mockup.width),
    fit: "contain" as const,
    mockup: { deviceId: device.id },
  };
}

interface MockupDialogProps {
  onClose: () => void;
  // The mockup image to edit in place; omitted when inserting a new one.
  target?: ImageElement;
}

export function MockupDialog({ onClose, target }: MockupDialogProps) {
  const activeSlide = useEditorStore(selectActiveSlide);
  const addElement = useEditorStore((state) => state.addElement);
  const updateElement = useEditorStore((state) => state.updateElement);
  const initialDevice =
    (target?.mockup && getMockupDevice(target.mockup.deviceId)) ??
    MOCKUP_DEVICES[0];
  const [device, setDevice] = useState(initialDevice);
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [renderState, setRenderState] = useState<RenderState | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  useEffect(() => {
    if (!screenshot) {
      return;
    }

    let isCancelled = false;

    renderMockup(device, screenshot.dataUrl).then(
      (result) => {
        if (!isCancelled) {
          setRenderState({ device, result, screenshot });
        }
      },
      (error: unknown) => {
        if (!isCancelled) {
          setRenderState({
            device,
            error:
              error instanceof Error
                ? error.message
                : "The mockup could not be rendered.",
            screenshot,
          });
        }
      },
    );

    return () => {
      isCancelled = true;
    };
  }, [device, screenshot]);

  const currentRender =
    renderState?.device === device && renderState.screenshot === screenshot
      ? renderState
      : null;
  const isRendering = screenshot !== null && currentRender === null;
  const error = uploadError ?? currentRender?.error ?? null;
  const hasChanges =
    !target || screenshot !== null || device.id !== initialDevice.id;

  // Without a screenshot the frame's own blank screen is the mockup.
  const output = useMemo<RenderedMockup | null>(
    () =>
      screenshot
        ? (currentRender?.result ?? null)
        : { src: device.frameSrc, width: device.width, height: device.height },
    [currentRender, device, screenshot],
  );

  const previewSlide = useMemo<Slide | null>(() => {
    if (!output) {
      return null;
    }

    if (target && activeSlide) {
      return {
        ...activeSlide,
        elements: activeSlide.elements.map((element) =>
          element.id === target.id
            ? { ...target, ...getMockupUpdates(target, device, output) }
            : element,
        ),
      };
    }

    return {
      id: "mockup-preview",
      background: GENERATOR_PREVIEW_BACKGROUND,
      elements: [createMockupElement(device, output)],
    };
  }, [activeSlide, device, output, target]);

  const loadScreenshot = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      const loaded = await loadImageFile(file);
      setUploadError(null);
      setScreenshot({ ...loaded, name: file.name });
    } catch (loadError) {
      setUploadError(
        loadError instanceof Error
          ? loadError.message
          : "The image could not be read.",
      );
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;

    void loadScreenshot(input.files?.[0]).finally(() => {
      input.value = "";
    });
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingFile(false);
    void loadScreenshot(event.dataTransfer.files[0]);
  };

  const handleInsert = () => {
    if (!activeSlide || !output || !hasChanges) {
      return;
    }

    if (target) {
      updateElement(
        activeSlide.id,
        target.id,
        getMockupUpdates(target, device, output),
      );
    } else {
      addElement(activeSlide.id, createMockupElement(device, output));
    }

    onClose();
  };

  return (
    <GeneratorDialog
      closeLabel="Close mockup dialog"
      description="Pick a device and upload a screenshot; it follows the phone's 3D angle."
      insertDisabled={!activeSlide || !output || !hasChanges}
      insertLabel={
        isRendering ? "Rendering…" : target ? "Apply mockup" : "Insert mockup"
      }
      onClose={onClose}
      onInsert={handleInsert}
      previewEmptyMessage={
        isRendering ? "Rendering mockup…" : (error ?? "Preview unavailable.")
      }
      previewNote={
        target
          ? "Replaces the selected mockup in place."
          : "Inserted on the current slide as one image. Select it later and choose Edit mockup to change the screen."
      }
      previewSlide={previewSlide}
      title={target ? "Edit mockup" : "Insert mockup"}
    >
      <section className="space-y-2">
        <p className="text-xs font-semibold text-primary">Device</p>
        <div className="grid grid-cols-2 gap-2">
          {MOCKUP_DEVICES.map((item) => {
            const isSelected = item.id === device.id;

            return (
              <button
                aria-pressed={isSelected}
                className={cn(
                  "rounded-2xl border p-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/35",
                  isSelected
                    ? "border-stroke-02 bg-surface-03 shadow-pressed"
                    : "border-stroke-01 bg-surface-01 hover:bg-surface-03",
                )}
                key={item.id}
                onClick={() => setDevice(item)}
                type="button"
              >
                <span className="flex h-32 items-center justify-center rounded-xl bg-surface-02">
                  {/* eslint-disable-next-line @next/next/no-img-element -- static asset thumbnail */}
                  <img
                    alt=""
                    className="h-28 w-auto object-contain"
                    src={item.frameSrc}
                  />
                </span>
                <span className="mt-2 block px-1 text-xs font-semibold text-primary">
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-3 space-y-2">
        <p className="text-xs font-semibold text-primary">Screen</p>
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stroke-02 p-5 text-center transition-colors focus-within:ring-2 focus-within:ring-ring/35",
            isDraggingFile
              ? "bg-surface-03"
              : "bg-surface-01 hover:bg-surface-03",
          )}
          onDragLeave={() => setIsDraggingFile(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDraggingFile(true);
          }}
          onDrop={handleDrop}
        >
          {screenshot ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
              <img
                alt=""
                className="h-24 w-auto rounded-md object-contain shadow-[0_0_0_1px_rgba(18,18,18,0.08)]"
                src={screenshot.dataUrl}
              />
              <span className="max-w-full truncate text-xs font-semibold text-primary">
                {screenshot.name}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Click or drop another image to change it
              </span>
            </>
          ) : (
            <>
              <ImageUp
                aria-hidden="true"
                className="size-5 text-muted-foreground"
                strokeWidth={1.8}
              />
              <span className="text-xs font-semibold text-primary">
                {target ? "Upload a new screenshot" : "Upload screenshot"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                PNG, JPG or WEBP · max 5 MB · or drop it here
              </span>
            </>
          )}
          <input
            accept={IMAGE_FILE_ACCEPT}
            aria-label="Choose screenshot"
            className="sr-only"
            onChange={handleFileChange}
            type="file"
          />
        </label>
        {screenshot ? (
          <Button
            className="w-full"
            onClick={() => setScreenshot(null)}
            variant="outline"
          >
            Remove screenshot
          </Button>
        ) : null}
        {error ? (
          <p className="text-[11px] font-medium text-destructive">{error}</p>
        ) : null}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Screenshots are cropped to the iPhone screen ratio from the top.
          Without one, the phone keeps its blank screen.
        </p>
      </section>
    </GeneratorDialog>
  );
}
