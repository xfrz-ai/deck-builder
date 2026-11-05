"use client";

import { Check, Palette } from "lucide-react";

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
import {
  BACKGROUND_THEMES,
  createBackgroundPreviewSlide,
} from "@/lib/backgrounds/background-themes";
import { selectActiveSlide, useEditorStore } from "@/store/editor-store";
import {
  PRESENTATION_HEIGHT,
  PRESENTATION_WIDTH,
} from "@/types/presentation";

const PREVIEW_WIDTH = 229;
const PREVIEW_SCALE = PREVIEW_WIDTH / PRESENTATION_WIDTH;
const BACKGROUND_PREVIEWS = BACKGROUND_THEMES.map((theme) => ({
  slide: createBackgroundPreviewSlide(theme),
  theme,
}));

export function BackgroundPicker() {
  const activeSlide = useEditorStore(selectActiveSlide);
  const setSlideBackgroundTheme = useEditorStore(
    (state) => state.setSlideBackgroundTheme,
  );

  if (!activeSlide) {
    return null;
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button aria-label="Choose background" size="tool" variant="ghost">
              <Palette className="size-[18px]" strokeWidth={1.8} />
              Background
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Background themes</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="center"
        className="w-[516px] p-3"
        sideOffset={14}
      >
        <div className="px-1 pb-3 pt-1">
          <p className="text-[14px] font-semibold tracking-[-0.02em] text-primary">
            Background themes
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Replace the locked background without changing slide content.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {BACKGROUND_PREVIEWS.map(({ slide, theme }) => {
            const isActive = activeSlide.backgroundThemeId === theme.id;

            return (
              <DropdownMenuItem
                aria-label={`Use ${theme.name} background`}
                className="block rounded-2xl bg-surface-03 p-1.5 transition-shadow focus:bg-surface-03 data-[highlighted]:shadow-[0_0_0_1.5px_#7b7b7b_inset,0_0_0_4px_#fcfcfc_inset] data-[highlighted]:bg-surface-03"
                key={theme.id}
                onSelect={() =>
                  setSlideBackgroundTheme(activeSlide.id, theme.id)
                }
              >
                <div className="relative aspect-video overflow-hidden rounded-xl bg-white">
                  <ClientSlideRenderer
                    interactive={false}
                    logicalHeight={PRESENTATION_HEIGHT}
                    logicalWidth={PRESENTATION_WIDTH}
                    scale={PREVIEW_SCALE}
                    slide={slide}
                  />
                  <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/[0.04]" />
                </div>
                <div className="flex items-center justify-between px-1.5 pb-1 pt-2.5">
                  <span className="text-xs font-semibold text-primary">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
