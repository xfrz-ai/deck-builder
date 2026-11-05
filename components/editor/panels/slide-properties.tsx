"use client";

import { useState } from "react";

import { isSolidHexColor } from "@/lib/slides/slide-utils";
import { selectActiveSlide, useEditorStore } from "@/store/editor-store";

interface BackgroundControlProps {
  background: string;
  slideId: string;
}

function BackgroundControl({ background, slideId }: BackgroundControlProps) {
  const [draftColor, setDraftColor] = useState(background);
  const updateSlideBackground = useEditorStore(
    (state) => state.updateSlideBackground,
  );

  const applyColor = (color: string) => {
    const normalizedColor = color.toUpperCase();
    setDraftColor(normalizedColor);

    if (isSolidHexColor(normalizedColor)) {
      updateSlideBackground(slideId, normalizedColor);
    }
  };

  return (
    <div className="flex items-center rounded-[10px] border border-surface-03 bg-surface-03 p-1 transition-colors focus-within:border-stroke-02 focus-within:bg-surface-02">
      <input
        aria-label="Slide background color"
        className="mr-3 size-7 cursor-pointer overflow-hidden rounded-md border border-[#323232]/10 bg-transparent p-0 [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0"
        id="slide-background"
        onChange={(event) => applyColor(event.target.value)}
        type="color"
        value={background}
      />
      <input
        aria-label="Slide background hex value"
        className="min-w-0 flex-1 bg-transparent text-xs font-medium uppercase tabular-nums text-primary outline-none"
        maxLength={7}
        onBlur={() => setDraftColor(background)}
        onChange={(event) => applyColor(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        spellCheck={false}
        value={draftColor}
      />
    </div>
  );
}

export function SlideProperties() {
  const activeSlide = useEditorStore(selectActiveSlide);
  if (!activeSlide) {
    return null;
  }

  return (
    <section>
      <h3 className="flex min-h-12 items-center px-4 py-3 text-xs font-semibold text-primary">
        <label htmlFor="slide-background">Background</label>
      </h3>
      <div className="space-y-2 px-4 pb-4">
        <BackgroundControl
          background={activeSlide.background}
          key={activeSlide.id}
          slideId={activeSlide.id}
        />
        <p className="text-[11px] leading-4 text-muted-foreground">
          Solid colors only in this phase.
        </p>
      </div>
    </section>
  );
}
