"use client";

import { Check, Palette } from "lucide-react";
import { useMemo } from "react";

import { ClientSlideRenderer } from "@/components/editor/client-slide-renderer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { applyThemeToSlide } from "@/lib/themes/apply-theme";
import { DECK_THEMES, getDeckTheme } from "@/lib/themes/deck-themes";
import { selectActiveSlide, useEditorStore } from "@/store/editor-store";
import {
  PRESENTATION_HEIGHT,
  PRESENTATION_WIDTH,
  type Slide,
} from "@/types/presentation";

const PREVIEW_WIDTH = 184;
const PREVIEW_SCALE = PREVIEW_WIDTH / PRESENTATION_WIDTH;

function ThemePreviews({ slide }: { slide: Slide }) {
  const setSlideTheme = useEditorStore((state) => state.setSlideTheme);
  // The active slide recolored in each theme.
  const previews = useMemo(
    () =>
      DECK_THEMES.map((theme) => ({
        theme,
        slide: { ...applyThemeToSlide(slide, theme.id), id: `theme-preview-${theme.id}` },
      })),
    [slide],
  );

  return (
    <div className="grid grid-cols-3 gap-2">
      {previews.map(({ slide: preview, theme }) => {
        const isActive = slide.themeId === theme.id;

        return (
          <DropdownMenuItem
            aria-label={`Use ${theme.name} theme`}
            className="block rounded-2xl bg-surface-03 p-1.5 transition-shadow focus:bg-surface-03 data-[highlighted]:shadow-[0_0_0_1.5px_#7b7b7b_inset,0_0_0_4px_#fcfcfc_inset] data-[highlighted]:bg-surface-03"
            key={theme.id}
            onSelect={() => setSlideTheme(slide.id, theme.id)}
          >
            <div className="relative aspect-video overflow-hidden rounded-xl bg-white">
              <ClientSlideRenderer
                interactive={false}
                logicalHeight={PRESENTATION_HEIGHT}
                logicalWidth={PRESENTATION_WIDTH}
                scale={PREVIEW_SCALE}
                slide={preview}
              />
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/[0.04]" />
            </div>
            <div className="flex items-center justify-between gap-2 px-1.5 pb-1 pt-2.5">
              <span className="flex items-center gap-2 text-xs font-semibold text-primary">
                <span
                  aria-hidden
                  className="size-3 rounded-full ring-1 ring-inset ring-black/10"
                  style={{ background: theme.colors.background }}
                />
                {theme.name}
              </span>
              {isActive ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-surface-01">
                  <Check className="size-3" strokeWidth={2.4} />
                </span>
              ) : null}
            </div>
          </DropdownMenuItem>
        );
      })}
    </div>
  );
}

export function ThemePicker() {
  const activeSlide = useEditorStore(selectActiveSlide);
  const applyThemeToAllSlides = useEditorStore(
    (state) => state.applyThemeToAllSlides,
  );

  if (!activeSlide) {
    return null;
  }

  const activeTheme = activeSlide.themeId
    ? getDeckTheme(activeSlide.themeId)
    : null;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button aria-label="Choose slide theme" size="tool" variant="ghost">
              <Palette className="size-[18px]" strokeWidth={1.8} />
              Theme
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Slide themes</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="center"
        className="w-[620px] p-3"
        sideOffset={14}
      >
        <div className="px-1 pb-3 pt-1">
          <p className="text-[14px] font-semibold tracking-[-0.02em] text-primary">
            Slide theme
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Changes the background of this slide and swaps any text, shapes or
            3D objects that would clash with it.
          </p>
        </div>
        <ThemePreviews slide={activeSlide} />
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-stroke-01 px-1 pt-3">
          <p className="text-xs text-muted-foreground">
            {activeTheme
              ? `This slide uses the ${activeTheme.name} theme.`
              : "Pick a theme for this slide first."}
          </p>
          <DropdownMenuItem
            asChild
            disabled={!activeTheme}
            onSelect={() => {
              if (activeTheme) applyThemeToAllSlides(activeTheme.id);
            }}
          >
            <Button size="sm" variant="outline">
              {activeTheme
                ? `Apply ${activeTheme.name} to all slides`
                : "Apply to all slides"}
            </Button>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
