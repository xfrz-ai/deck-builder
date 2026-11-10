"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ArrowLeft, LayoutTemplate, PanelTop } from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { SlideLayoutPicker } from "@/components/editor/slide-layout-picker";
import { SlideThumbnail } from "@/components/editor/slide-thumbnail";
import { DisabledControl } from "@/components/editor/top-bar";
import { Button } from "@/components/ui/button";
import type { SlideLayoutId } from "@/lib/layouts/layout-registry";
import { useEditorStore } from "@/store/editor-store";

export function SlideSidebar() {
  const [isLayoutPickerOpen, setIsLayoutPickerOpen] = useState(false);
  const slides = useEditorStore((state) => state.presentation.slides);
  const title = useEditorStore((state) => state.presentation.title);
  const updatePresentationTitle = useEditorStore(
    (state) => state.updatePresentationTitle,
  );
  const logicalWidth = useEditorStore((state) => state.presentation.width);
  const logicalHeight = useEditorStore((state) => state.presentation.height);
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const addLayoutSlide = useEditorStore((state) => state.addLayoutSlide);
  const addSlide = useEditorStore((state) => state.addSlide);
  const reorderSlides = useEditorStore((state) => state.reorderSlides);
  const deleteSlide = useEditorStore((state) => state.deleteSlide);
  const slideListRef = useRef<HTMLOListElement>(null);
  const shouldRestoreFocusRef = useRef(false);
  const slideIds = useMemo(
    () => slides.map((slide) => slide.id),
    [slides],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter selects the focused slide; Space picks it up for reordering.
      keyboardCodes: {
        cancel: ["Escape"],
        end: ["Space", "Enter"],
        start: ["Space"],
      },
    }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = slides.findIndex((slide) => slide.id === active.id);
    const newIndex = slides.findIndex((slide) => slide.id === over.id);

    if (oldIndex >= 0 && newIndex >= 0) {
      reorderSlides(oldIndex, newIndex);
    }
  };

  const handleSlideListKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    if (
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      (event.key !== "Delete" && event.key !== "Backspace")
    ) {
      return;
    }

    const slideId = (event.target as HTMLElement)
      .closest<HTMLElement>("[data-slide-id]")
      ?.dataset.slideId;

    if (!slideId) {
      return;
    }

    event.preventDefault();

    if (slides.length > 1) {
      shouldRestoreFocusRef.current = true;
      deleteSlide(slideId);
    }
  };

  // The focused thumbnail unmounts on delete; move focus to the new active
  // slide so repeated Delete/Backspace presses keep working.
  useEffect(() => {
    if (!shouldRestoreFocusRef.current) {
      return;
    }

    shouldRestoreFocusRef.current = false;
    slideListRef.current
      ?.querySelector<HTMLButtonElement>(
        `[data-slide-id="${activeSlideId}"] [data-slide-select]`,
      )
      ?.focus();
  }, [activeSlideId, slides]);

  const closeLayoutPicker = useCallback(() => {
    setIsLayoutPickerOpen(false);
  }, []);

  const handleAddBlankSlide = useCallback(() => {
    addSlide();
    closeLayoutPicker();
  }, [addSlide, closeLayoutPicker]);

  const handleAddLayoutSlide = useCallback(
    (layoutId: SlideLayoutId) => {
      addLayoutSlide(layoutId);
      closeLayoutPicker();
    },
    [addLayoutSlide, closeLayoutPicker],
  );

  return (
    <aside className="absolute bottom-3 left-3 top-3 z-10 flex w-60 flex-col rounded-[1.25rem] border border-stroke-01 bg-surface-01">
      <div className="border-b border-stroke-01 p-4 pb-3">
        <div className="mb-3 flex items-center justify-between">
          <div
            aria-label="Deck presentation editor"
            className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-surface-01"
            role="img"
          >
            <PanelTop className="size-4" strokeWidth={2} />
          </div>
          <DisabledControl label="Back navigation is not available in Phase 1">
            <Button aria-label="Back" disabled size="icon-sm" variant="ghost">
              <ArrowLeft className="size-4" strokeWidth={1.8} />
            </Button>
          </DisabledControl>
        </div>
        <input
          aria-label="Presentation title"
          className="-mx-1.5 h-7 w-[calc(100%+12px)] rounded-md border border-transparent bg-transparent px-1.5 text-[15px] font-semibold leading-6 tracking-[-0.02em] text-primary outline-none transition hover:bg-surface-03 focus:border-stroke-02 focus:bg-surface-02"
          maxLength={80}
          onChange={(event) => updatePresentationTitle(event.target.value)}
          spellCheck={false}
          value={title}
        />
        <p className="py-0.5 text-xs font-medium text-muted-foreground/80">
          {slides.length} {slides.length === 1 ? "slide" : "slides"}
        </p>
      </div>

      <div className="border-b border-stroke-01 p-3">
        <Button
          aria-controls="slide-layout-picker"
          aria-expanded={isLayoutPickerOpen}
          aria-label="Browse templates"
          className="w-full"
          onClick={() => setIsLayoutPickerOpen((isOpen) => !isOpen)}
        >
          <LayoutTemplate className="size-4" strokeWidth={2} />
          Browse templates
        </Button>
      </div>

      <div className="editor-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <SortableContext
            items={slideIds}
            strategy={verticalListSortingStrategy}
          >
            <ol
              className="flex flex-col gap-1"
              onKeyDown={handleSlideListKeyDown}
              ref={slideListRef}
            >
              {slides.map((slide, index) => (
                <SlideThumbnail
                  index={index}
                  isActive={slide.id === activeSlideId}
                  key={slide.id}
                  logicalHeight={logicalHeight}
                  logicalWidth={logicalWidth}
                  slide={slide}
                  slideCount={slides.length}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </div>

      <SlideLayoutPicker
        onClose={closeLayoutPicker}
        onSelectBlank={handleAddBlankSlide}
        onSelectLayout={handleAddLayoutSlide}
        open={isLayoutPickerOpen}
      />
    </aside>
  );
}
