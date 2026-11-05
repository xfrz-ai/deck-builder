"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ClientSlideRenderer } from "@/components/editor/client-slide-renderer";
import { Button } from "@/components/ui/button";
import {
  PRESENTATION_HEIGHT,
  PRESENTATION_WIDTH,
  type Slide,
} from "@/types/presentation";

// Generators preview their output alone on a plain white slide, so the
// active slide's content never overlaps it.
export const GENERATOR_PREVIEW_BACKGROUND = "#FFFFFF";

export const generatorInputClassName =
  "h-9 w-full rounded-[10px] border border-surface-03 bg-surface-03 px-2.5 text-xs font-medium text-primary outline-none transition-colors focus:border-stroke-02 focus:bg-surface-02";

function GeneratorPreview({
  emptyMessage,
  slide,
}: {
  emptyMessage: string;
  slide: Slide | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(18,18,18,0.06),0_8px_16px_-12px_rgba(0,0,0,0.13)]"
      ref={containerRef}
    >
      {slide && width > 0 ? (
        <div className="pointer-events-none absolute inset-0">
          <ClientSlideRenderer
            interactive={false}
            logicalHeight={PRESENTATION_HEIGHT}
            logicalWidth={PRESENTATION_WIDTH}
            scale={width / PRESENTATION_WIDTH}
            slide={slide}
          />
        </div>
      ) : (
        <div className="flex size-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

interface GeneratorDialogProps {
  children: ReactNode;
  closeLabel: string;
  description: string;
  insertDisabled: boolean;
  insertLabel: string;
  onClose: () => void;
  onInsert: () => void;
  previewEmptyMessage: string;
  previewNote: string;
  previewSlide: Slide | null;
  title: string;
}

export function GeneratorDialog({
  children,
  closeLabel,
  description,
  insertDisabled,
  insertLabel,
  onClose,
  onInsert,
  previewEmptyMessage,
  previewNote,
  previewSlide,
  title,
}: GeneratorDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const animationFrame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[#121212]/20 backdrop-blur-[2px]"
        onMouseDown={onClose}
      />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative flex h-[min(720px,calc(100dvh-48px))] w-[min(1180px,calc(100vw-48px))] flex-col overflow-hidden rounded-[1.25rem] border border-stroke-01 bg-surface-01 shadow-popover"
        // Editor shortcuts (Delete, arrows, undo) must not reach the canvas
        // behind the dialog; Escape still bubbles up to close it.
        onKeyDown={(event) => {
          if (event.key !== "Escape") {
            event.stopPropagation();
          }
        }}
        ref={dialogRef}
        role="dialog"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-stroke-01 p-3 pl-5">
          <div className="flex items-center gap-4">
            <h2
              className="text-[15px] font-semibold tracking-[-0.02em] text-primary"
              id={titleId}
            >
              {title}
            </h2>
            <p className="text-[13px] text-muted-foreground">{description}</p>
          </div>
          <Button
            aria-label={closeLabel}
            className="text-muted-foreground hover:text-primary"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" strokeWidth={2} />
          </Button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[400px_minmax(0,1fr)]">
          <div className="editor-scrollbar flex min-h-0 flex-col gap-2 overflow-y-auto border-r border-stroke-01 p-4">
            {children}
          </div>

          <div className="flex min-h-0 flex-col gap-3 bg-surface-02 p-6">
            <p className="text-xs font-semibold text-primary">Preview</p>
            <div className="flex min-h-0 flex-1 items-center">
              <GeneratorPreview
                emptyMessage={previewEmptyMessage}
                slide={previewSlide}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">{previewNote}</p>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-stroke-01 p-3">
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button disabled={insertDisabled} onClick={onInsert}>
            {insertLabel}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
