"use client";

import { Grid3x3, Maximize2, Minus, Moon, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SwitchIndicator } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MAX_ZOOM, MIN_ZOOM } from "@/lib/canvas/zoom";
import { useEditorStore } from "@/store/editor-store";

interface ZoomControlsProps {
  fitScale: number;
}

function ZoomButton({
  label,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label={label} size="icon-sm" variant="ghost" {...props} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function ZoomControls({ fitScale }: ZoomControlsProps) {
  const zoom = useEditorStore((state) => state.zoom);
  const zoomMode = useEditorStore((state) => state.zoomMode);
  const zoomIn = useEditorStore((state) => state.zoomIn);
  const zoomOut = useEditorStore((state) => state.zoomOut);
  const fitToWorkspace = useEditorStore((state) => state.fitToWorkspace);
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const isDarkMode = useEditorStore(
    (state) =>
      state.presentation.slides.find((slide) => slide.id === activeSlideId)
        ?.darkMode === true,
  );
  const toggleSlideDarkMode = useEditorStore(
    (state) => state.toggleSlideDarkMode,
  );
  const showLayoutGrid = useEditorStore((state) => state.showLayoutGrid);
  const toggleLayoutGrid = useEditorStore((state) => state.toggleLayoutGrid);
  const percentage = Math.round(zoom * 100);

  return (
    <div
      aria-label="Canvas zoom controls"
      className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-stroke-01 bg-surface-01 p-1.5 shadow-toolbar"
      role="toolbar"
    >
      <ZoomButton
        disabled={zoom <= MIN_ZOOM}
        label="Zoom out"
        onClick={zoomOut}
      >
        <Minus className="size-4" strokeWidth={1.9} />
      </ZoomButton>

      <output
        aria-live="polite"
        className="flex h-8 w-[58px] items-center justify-center rounded-lg border border-stroke-01 bg-surface-03 text-xs font-semibold tabular-nums text-primary"
      >
        {percentage}%
      </output>

      <ZoomButton
        disabled={zoom >= MAX_ZOOM}
        label="Zoom in"
        onClick={zoomIn}
      >
        <Plus className="size-4" strokeWidth={1.9} />
      </ZoomButton>

      <div className="mx-1 h-5 w-px bg-stroke-01" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-pressed={zoomMode === "fit"}
            className="h-8 rounded-lg px-2.5"
            onClick={() => fitToWorkspace(fitScale)}
            size="sm"
            variant="ghost"
          >
            <Maximize2 className="size-3.5" strokeWidth={1.8} />
            Fit
          </Button>
        </TooltipTrigger>
        <TooltipContent>Fit slide to workspace</TooltipContent>
      </Tooltip>

      <div className="mx-1 h-5 w-px bg-stroke-01" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-checked={isDarkMode}
            className="group flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-primary outline-none transition hover:bg-surface-03 focus-visible:ring-2 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-40"
            disabled={!activeSlideId}
            onClick={() => toggleSlideDarkMode(activeSlideId)}
            role="switch"
            type="button"
          >
            <Moon className="size-3.5" strokeWidth={1.8} />
            Dark
            <SwitchIndicator checked={isDarkMode} />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {isDarkMode
            ? "Switch slide text back to black"
            : "Switch slide text to white"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-checked={showLayoutGrid}
            className="group flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-primary outline-none transition hover:bg-surface-03 focus-visible:ring-2 focus-visible:ring-ring/35"
            onClick={toggleLayoutGrid}
            role="switch"
            type="button"
          >
            <Grid3x3 className="size-3.5" strokeWidth={1.8} />
            Grid
            <SwitchIndicator checked={showLayoutGrid} />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          Show the 24×12 layout grid. Elements always snap to it; hold
          ⌘/Ctrl while dragging to move freely.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
