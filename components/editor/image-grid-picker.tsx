"use client";

import { LayoutDashboard } from "lucide-react";

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
  createImageGridElements,
  getImageGridRects,
  IMAGE_GRID_AREA,
  IMAGE_GRID_LAYOUTS,
  type ImageGridLayout,
} from "@/lib/elements/create-image-grid-elements";
import { useEditorStore } from "@/store/editor-store";

function ImageGridPreview({ layout }: { layout: ImageGridLayout }) {
  const { height, width, x, y } = IMAGE_GRID_AREA;

  return (
    <span
      aria-hidden="true"
      className="relative block w-full overflow-hidden rounded-md border border-stroke-01 bg-surface-01"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {getImageGridRects(layout).map((rect, index) => (
        <span
          className="absolute rounded-[3px] bg-[#d4d4d4]"
          key={index}
          style={{
            left: `${((rect.x - x) / width) * 100}%`,
            top: `${((rect.y - y) / height) * 100}%`,
            width: `${(rect.width / width) * 100}%`,
            height: `${(rect.height / height) * 100}%`,
          }}
        />
      ))}
    </span>
  );
}

export function ImageGridPicker() {
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const addElements = useEditorStore((state) => state.addElements);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button aria-label="Insert image grid" size="tool" variant="ghost">
              <LayoutDashboard className="size-[18px]" strokeWidth={1.8} />
              Img Grid
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Insert image grid</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="center"
        className="w-[520px] p-3"
        sideOffset={14}
      >
        <div className="px-1 pb-3 pt-1">
          <p className="text-[14px] font-semibold tracking-[-0.02em] text-primary">
            Image grid
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Placeholders fill the slide between header and footer. Replace each
            one with your own image.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {IMAGE_GRID_LAYOUTS.map((layout) => (
            <DropdownMenuItem
              aria-label={`Insert ${layout.name} image grid`}
              className="flex-col items-stretch gap-1.5 rounded-xl bg-surface-03 p-1.5 focus:bg-surface-03 data-[highlighted]:bg-surface-03 data-[highlighted]:shadow-[0_0_0_1.5px_#7b7b7b_inset,0_0_0_4px_#fcfcfc_inset]"
              key={layout.id}
              onSelect={() =>
                addElements(activeSlideId, createImageGridElements(layout))
              }
            >
              <ImageGridPreview layout={layout} />
              <span className="truncate px-0.5 text-[11px] font-medium text-primary">
                {layout.name}
              </span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
