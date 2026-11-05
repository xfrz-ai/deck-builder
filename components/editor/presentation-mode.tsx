"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ClientSlideRenderer } from "@/components/editor/client-slide-renderer";
import { preloadImage } from "@/hooks/use-loaded-image";
import { cn } from "@/lib/utils";
import {
  PRESENTATION_HEIGHT,
  PRESENTATION_WIDTH,
  type Slide,
} from "@/types/presentation";

// Controls and cursor hide after the pointer rests this long.
const IDLE_HIDE_MS = 2200;

const NEXT_KEYS = new Set([
  "ArrowRight",
  "ArrowDown",
  "PageDown",
  " ",
  "Enter",
  "n",
  "N",
]);
const PREVIOUS_KEYS = new Set([
  "ArrowLeft",
  "ArrowUp",
  "PageUp",
  "Backspace",
  "p",
  "P",
]);

function getFitScale() {
  return Math.min(
    window.innerWidth / PRESENTATION_WIDTH,
    window.innerHeight / PRESENTATION_HEIGHT,
  );
}

interface PresentationModeProps {
  initialSlideId: string;
  // Called with the slide on screen, so the editor can return to it.
  onExit: (slideId: string) => void;
  slides: readonly Slide[];
}

export function PresentationMode({
  initialSlideId,
  onExit,
  slides,
}: PresentationModeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      slides.findIndex((slide) => slide.id === initialSlideId),
    ),
  );
  const [scale, setScale] = useState(getFitScale);
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<number | null>(null);
  const lastIndex = slides.length - 1;
  const slide = slides[Math.min(index, lastIndex)];

  const goTo = useCallback(
    (next: number) => setIndex(Math.min(Math.max(next, 0), lastIndex)),
    [lastIndex],
  );

  const exit = useCallback(() => {
    if (document.fullscreenElement) {
      // The fullscreenchange handler finishes the exit.
      void document.exitFullscreen();
      return;
    }

    onExit(slides[Math.min(index, lastIndex)]?.id ?? initialSlideId);
  }, [index, initialSlideId, lastIndex, onExit, slides]);

  // Read through a ref so the fullscreen effect below runs only once.
  const exitRef = useRef(exit);
  useEffect(() => {
    exitRef.current = exit;
  }, [exit]);

  // Warm the image cache for every slide so navigating never flashes.
  useEffect(() => {
    for (const item of slides) {
      for (const element of item.elements) {
        if (element.type === "image") {
          preloadImage(element.src);
        }
      }
    }
  }, [slides]);

  useEffect(() => {
    const updateScale = () => setScale(getFitScale());

    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  // Fullscreen when the browser allows it; leaving fullscreen (e.g. the
  // browser's own Esc) ends the presentation. The refs survive React's
  // dev-mode double effect run, so fullscreen is requested only once.
  const fullscreenRequestedRef = useRef(false);
  const inFullscreenRef = useRef(false);
  useEffect(() => {
    const root = rootRef.current;

    if (root && !fullscreenRequestedRef.current) {
      fullscreenRequestedRef.current = true;
      root.requestFullscreen?.().catch(() => {
        // Stays as a full-window overlay instead.
      });
    }

    const handleFullscreenChange = () => {
      if (document.fullscreenElement === root) {
        inFullscreenRef.current = true;
      } else if (inFullscreenRef.current) {
        inFullscreenRef.current = false;
        exitRef.current();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Leave fullscreen if the overlay unmounts while still in it.
  useEffect(
    () => () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      }
    },
    [],
  );

  // Captured on window so the editor's own shortcuts (delete, paste, slide
  // navigation…) never see keys pressed while presenting.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      event.stopImmediatePropagation();

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (NEXT_KEYS.has(event.key)) {
        event.preventDefault();
        goTo(index + 1);
      } else if (PREVIOUS_KEYS.has(event.key)) {
        event.preventDefault();
        goTo(index - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        goTo(0);
      } else if (event.key === "End") {
        event.preventDefault();
        goTo(lastIndex);
      } else if (event.key === "Escape") {
        event.preventDefault();
        exit();
      }
    };
    const blockClipboard = (event: Event) => event.stopImmediatePropagation();

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("copy", blockClipboard, true);
    window.addEventListener("cut", blockClipboard, true);
    window.addEventListener("paste", blockClipboard, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("copy", blockClipboard, true);
      window.removeEventListener("cut", blockClipboard, true);
      window.removeEventListener("paste", blockClipboard, true);
    };
  }, [exit, goTo, index, lastIndex]);

  const scheduleIdle = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = window.setTimeout(
      () => setIsIdle(true),
      IDLE_HIDE_MS,
    );
  }, []);

  const wake = useCallback(() => {
    setIsIdle(false);
    scheduleIdle();
  }, [scheduleIdle]);

  // Controls start visible, then fade once the pointer rests.
  useEffect(() => {
    scheduleIdle();

    return () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
      }
    };
  }, [scheduleIdle]);

  if (!slide) {
    return null;
  }

  return createPortal(
    <div
      aria-label="Presentation"
      aria-roledescription="slideshow"
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-black select-none",
        isIdle && "cursor-none",
      )}
      onClick={() => goTo(index + 1)}
      onContextMenu={(event) => {
        event.preventDefault();
        goTo(index - 1);
      }}
      onMouseMove={wake}
      ref={rootRef}
      role="region"
    >
      <div
        aria-label={`Slide ${index + 1} of ${slides.length}`}
        className="relative overflow-hidden"
        role="group"
        style={{
          width: PRESENTATION_WIDTH * scale,
          height: PRESENTATION_HEIGHT * scale,
        }}
      >
        <ClientSlideRenderer
          interactive={false}
          key={slide.id}
          logicalHeight={PRESENTATION_HEIGHT}
          logicalWidth={PRESENTATION_WIDTH}
          scale={scale}
          slide={slide}
        />
      </div>

      <div
        className={cn(
          "absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#121212]/80 p-1.5 text-white shadow-lg backdrop-blur transition-opacity duration-300",
          isIdle ? "pointer-events-none opacity-0" : "opacity-100",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Previous slide"
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent"
          disabled={index === 0}
          onClick={() => goTo(index - 1)}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={2} />
        </button>
        <span
          aria-live="polite"
          className="min-w-16 px-1 text-center text-[13px] font-medium tabular-nums"
        >
          {index + 1} / {slides.length}
        </span>
        <button
          aria-label="Next slide"
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent"
          disabled={index === lastIndex}
          onClick={() => goTo(index + 1)}
          type="button"
        >
          <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2} />
        </button>
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/20" />
        <button
          aria-label="Exit presentation"
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15"
          onClick={exit}
          type="button"
        >
          <X aria-hidden="true" className="size-4" strokeWidth={2} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
