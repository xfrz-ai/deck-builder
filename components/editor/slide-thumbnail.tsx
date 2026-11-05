"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo } from "react";

import { ClientSlideRenderer } from "@/components/editor/client-slide-renderer";
import { SlideContextMenu } from "@/components/editor/slide-context-menu";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor-store";
import type { Slide } from "@/types/presentation";

const THUMBNAIL_RENDER_WIDTH = 176;

interface SlideThumbnailProps {
  index: number;
  isActive: boolean;
  logicalHeight: number;
  logicalWidth: number;
  slide: Slide;
  slideCount: number;
}

export const SlideThumbnail = memo(function SlideThumbnail({
  index,
  isActive,
  logicalHeight,
  logicalWidth,
  slide,
  slideCount,
}: SlideThumbnailProps) {
  const selectSlide = useEditorStore((state) => state.selectSlide);
  const duplicateSlide = useEditorStore((state) => state.duplicateSlide);
  const deleteSlide = useEditorStore((state) => state.deleteSlide);
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: slide.id });

  return (
    <li
      data-slide-id={slide.id}
      ref={setNodeRef}
      style={{
        opacity: isDragging ? 0.5 : 1,
        position: "relative",
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <SlideContextMenu
        canDelete={slideCount > 1}
        onDelete={() => deleteSlide(slide.id)}
        onDuplicate={() => duplicateSlide(slide.id)}
      >
        <div
          className={cn(
            "grid grid-cols-[16px_minmax(0,1fr)] gap-2 rounded-xl border p-1.5 transition-colors",
            isActive
              ? "border-stroke-02 bg-surface-03"
              : "border-transparent hover:bg-surface-03",
          )}
          {...listeners}
        >
          <span
            className={cn(
              "pt-1 text-center text-[11px] font-semibold tabular-nums",
              isActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            {index + 1}
          </span>

          <div className="min-w-0">
            <button
              {...attributes}
              aria-current={isActive ? "page" : undefined}
              aria-label={`Select slide ${index + 1}`}
              className={cn(
                "relative block aspect-video w-full cursor-pointer overflow-hidden rounded-lg bg-white outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/40",
                isActive
                  ? "shadow-[0_0_0_1px_rgba(18,18,18,0.08),0_0_4px_0_rgba(18,18,18,0.10)]"
                  : "shadow-[0_0_0_1px_rgba(18,18,18,0.06)]",
                isDragging && "cursor-grabbing shadow-lg",
              )}
              data-slide-select=""
              onClick={(event) => {
                // Safari doesn't focus buttons on click; keep focus in the
                // slide list so Delete/Backspace can target this slide.
                event.currentTarget.focus();
                selectSlide(slide.id);
              }}
              ref={setActivatorNodeRef}
              type="button"
            >
              <span className="pointer-events-none absolute inset-0">
                <ClientSlideRenderer
                  interactive={false}
                  logicalHeight={logicalHeight}
                  logicalWidth={logicalWidth}
                  scale={THUMBNAIL_RENDER_WIDTH / logicalWidth}
                  slide={slide}
                />
              </span>
            </button>
          </div>
        </div>
      </SlideContextMenu>
    </li>
  );
});
