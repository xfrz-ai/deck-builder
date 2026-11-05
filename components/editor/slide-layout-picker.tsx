"use client";

import { LayoutTemplate, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ClientSlideRenderer } from "@/components/editor/client-slide-renderer";
import { Button } from "@/components/ui/button";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  SLIDE_LAYOUTS,
  type SlideLayoutId,
} from "@/lib/layouts/layout-registry";
import {
  PRESENTATION_HEIGHT,
  PRESENTATION_WIDTH,
  type Slide,
} from "@/types/presentation";

const BLANK_PREVIEW_SLIDE: Slide = {
  id: "layout-preview-blank",
  background: "#FFFFFF",
  elements: [],
};

// "All" stays last, so new categories go before it.
const LAYOUT_FILTERS = [
  { id: "cover", label: "Cover" },
  { id: "agenda", label: "Agenda" },
  { id: "team", label: "Our Team" },
  { id: "timeline", label: "Timeline" },
  { id: "table", label: "Table" },
  { id: "text", label: "Full Text" },
  { id: "mockup", label: "Mockup" },
  { id: "all", label: "All" },
] as const;

type LayoutFilter = (typeof LAYOUT_FILTERS)[number]["id"];

function getCategoryLabel(category: SlideLayoutDefinition["category"]) {
  return LAYOUT_FILTERS.find((item) => item.id === category)?.label ?? category;
}

interface LayoutPreviewProps {
  description: string;
  icon: "blank" | "layout";
  name: string;
  onSelect: () => void;
  slide: Slide;
}

function LayoutPreview({
  description,
  icon,
  name,
  onSelect,
  slide,
}: LayoutPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(0);

  useEffect(() => {
    const preview = previewRef.current;

    if (!preview) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setPreviewWidth(entry.contentRect.width);
      }
    });

    observer.observe(preview);
    return () => observer.disconnect();
  }, []);

  const scale = previewWidth / PRESENTATION_WIDTH;

  return (
    <button
      aria-label={`Add ${name}`}
      className="group overflow-hidden rounded-2xl bg-surface-03 p-1.5 text-left transition-shadow hover:shadow-[0_0_0_1.5px_#7b7b7b_inset,0_0_0_4px_#fcfcfc_inset] focus-visible:outline-none focus-visible:shadow-[0_0_0_1.5px_#7b7b7b_inset,0_0_0_4px_#fcfcfc_inset]"
      onClick={onSelect}
      type="button"
    >
      <div
        className="relative aspect-video overflow-hidden rounded-xl bg-surface-02"
        ref={previewRef}
      >
        {previewWidth > 0 ? (
          <div className="absolute inset-0">
            <ClientSlideRenderer
              interactive={false}
              logicalHeight={PRESENTATION_HEIGHT}
              logicalWidth={PRESENTATION_WIDTH}
              scale={scale}
              slide={slide}
            />
          </div>
        ) : (
          <div className="size-full animate-pulse bg-surface-03" />
        )}
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/[0.03]" />
      </div>

      <div className="flex items-center gap-3 px-1.5 pb-1.5 pt-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-01 text-primary shadow-[0_0_4px_0_rgba(18,18,18,0.10)]">
          {icon === "blank" ? (
            <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
          ) : (
            <LayoutTemplate
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.9}
            />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-primary">
            {name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {description}
          </span>
        </span>
      </div>
    </button>
  );
}

interface SlideLayoutPickerProps {
  onClose: () => void;
  onSelectBlank: () => void;
  onSelectLayout: (layoutId: SlideLayoutId) => void;
  open: boolean;
}

export function SlideLayoutPicker({
  onClose,
  onSelectBlank,
  onSelectLayout,
  open,
}: SlideLayoutPickerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<LayoutFilter>("cover");
  const showBlank = filter === "all";
  const visibleLayouts =
    filter === "all"
      ? SLIDE_LAYOUTS
      : SLIDE_LAYOUTS.filter((layout) => layout.category === filter);
  const layoutCount = visibleLayouts.length + (showBlank ? 1 : 0);

  useEffect(() => {
    if (!open) {
      return;
    }

    const animationFrame = requestAnimationFrame(() => {
      dialogRef.current?.focus();
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
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  // Portal out of the sidebar's stacking context so the picker sits above
  // the canvas toolbar.
  return createPortal(
    <>
      <div
        aria-hidden="true"
        className="fixed inset-y-0 left-[252px] right-0 z-30 bg-[#121212]/[0.04] backdrop-blur-[1px]"
        onMouseDown={onClose}
      />
      <div
        aria-label="Choose a slide layout"
        aria-modal="false"
        className="fixed bottom-3 left-[264px] top-3 z-40 flex w-[min(960px,calc(100vw-276px))] flex-col overflow-hidden rounded-[1.25rem] border border-stroke-01 bg-surface-01 shadow-popover outline-none"
        id="slide-layout-picker"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-stroke-01 p-3 pl-5">
          <div className="flex items-center gap-4">
            <div className="text-[15px] font-semibold tracking-[-0.02em] text-primary">
              Layouts
            </div>
            <p className="text-[13px] text-muted-foreground">
              Choose how your next slide starts
            </p>
          </div>
          <Button
            aria-label="Close slide layouts"
            className="text-muted-foreground hover:text-primary"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" strokeWidth={2} />
          </Button>
        </header>

        <div className="editor-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-medium tracking-[-0.03em] text-primary">
                Add a new slide
              </h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Choose a blank canvas or a ready-made layout.
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-surface-03 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {layoutCount} {layoutCount === 1 ? "layout" : "layouts"}
            </span>
          </div>

          <div
            aria-label="Filter layouts"
            className="mb-5 flex gap-1"
            role="group"
          >
            {LAYOUT_FILTERS.map((item) => (
              <Button
                aria-pressed={filter === item.id}
                key={item.id}
                onClick={() => setFilter(item.id)}
                size="sm"
                variant="ghost"
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {showBlank ? (
              <LayoutPreview
                description="A clean 16:9 canvas"
                icon="blank"
                name="Blank slide"
                onSelect={onSelectBlank}
                slide={BLANK_PREVIEW_SLIDE}
              />
            ) : null}
            {visibleLayouts.map((layout) => (
              <LayoutPreview
                description={`${getCategoryLabel(layout.category)} · Plus Jakarta Sans`}
                icon="layout"
                key={layout.id}
                name={layout.name}
                onSelect={() => onSelectLayout(layout.id)}
                slide={layout.slide}
              />
            ))}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
