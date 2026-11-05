"use client";

import {
  ChartGantt,
  Circle,
  ClipboardList,
  ImagePlus,
  LayoutGrid,
  LoaderCircle,
  RectangleHorizontal,
  Shapes,
  Smartphone,
  Square,
  Type,
} from "lucide-react";
import { type ComponentProps, useCallback, useRef, useState } from "react";

import { BackgroundPicker } from "@/components/editor/background-picker";
import { ImageGridPicker } from "@/components/editor/image-grid-picker";
import { MockupDialog } from "@/components/editor/mockup-dialog";
import { ScopeOfWorkGeneratorDialog } from "@/components/editor/scope-of-work-generator-dialog";
import { TimelineGeneratorDialog } from "@/components/editor/timeline-generator-dialog";
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
  createCircleElement,
  createRectangleElement,
  createRoundedRectangleElement,
  createTextElement,
} from "@/lib/elements/create-element";
import {
  CARD_GRID_OPTIONS,
  type CardGridColumns,
  createCardGridElements,
} from "@/lib/elements/create-card-elements";
import { createImageElement } from "@/lib/elements/create-image-element";
import { notifyEditor } from "@/lib/editor/notifications";
import { IMAGE_FILE_ACCEPT, loadImageFile } from "@/lib/image/image-file";
import { useEditorStore } from "@/store/editor-store";

function ToolButton({
  caption,
  children,
  label,
  ...props
}: ComponentProps<typeof Button> & { caption: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label={label} size="tool" variant="ghost" {...props}>
          {children}
          {caption}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function CardGridPreview({ columns }: { columns: CardGridColumns }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-8 w-14 shrink-0 gap-[3px] rounded-md border border-stroke-01 bg-surface-01 p-1"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: columns }, (_, index) => (
        <span className="flex flex-col gap-[2px]" key={index}>
          <span className="flex-1 rounded-[2px] bg-[#d4d4d4]" />
          <span className="h-[2px] w-3/4 rounded-full bg-[#7b7b7b]" />
          <span className="h-[2px] w-1/2 rounded-full bg-[#d4d4d4]" />
        </span>
      ))}
    </span>
  );
}

export function InsertToolbar() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const closeTimeline = useCallback(() => setIsTimelineOpen(false), []);
  const [isScopeOfWorkOpen, setIsScopeOfWorkOpen] = useState(false);
  const closeScopeOfWork = useCallback(() => setIsScopeOfWorkOpen(false), []);
  const [isMockupOpen, setIsMockupOpen] = useState(false);
  const closeMockup = useCallback(() => setIsMockupOpen(false), []);
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const addElement = useEditorStore((state) => state.addElement);
  const addElements = useEditorStore((state) => state.addElements);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    const targetSlideId = activeSlideId;

    if (!file) {
      return;
    }

    setIsUploadingImage(true);

    try {
      const { dataUrl, height, width } = await loadImageFile(file);
      addElement(
        targetSlideId,
        createImageElement({
          originalHeight: height,
          originalWidth: width,
          src: dataUrl,
        }),
      );
    } catch (error) {
      notifyEditor(
        error instanceof Error
          ? error.message
          : "The image could not be uploaded.",
      );
    } finally {
      input.value = "";
      setIsUploadingImage(false);
    }
  };

  return (
    <div aria-label="Insert tools" className="flex gap-1 p-2" role="group">
      <ToolButton
        caption="Text"
        label="Insert text"
        onClick={() => addElement(activeSlideId, createTextElement())}
      >
        <Type className="size-[18px]" strokeWidth={1.8} />
      </ToolButton>

      <ToolButton
        caption="Image"
        disabled={isUploadingImage}
        label={isUploadingImage ? "Loading image…" : "Insert image"}
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploadingImage ? (
          <LoaderCircle
            className="size-[18px] animate-spin"
            strokeWidth={1.8}
          />
        ) : (
          <ImagePlus className="size-[18px]" strokeWidth={1.8} />
        )}
      </ToolButton>
      <input
        accept={IMAGE_FILE_ACCEPT}
        aria-label="Choose image file"
        className="sr-only"
        onChange={handleImageUpload}
        ref={fileInputRef}
        type="file"
      />
      <ImageGridPicker />
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button aria-label="Insert shape" size="tool" variant="ghost">
                <Shapes className="size-[18px]" strokeWidth={1.8} />
                Shape
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Insert shape</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="center" sideOffset={14}>
          <DropdownMenuItem
            onSelect={() => addElement(activeSlideId, createRectangleElement())}
          >
            <RectangleHorizontal className="size-4" strokeWidth={1.8} />
            Rectangle
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              addElement(activeSlideId, createRoundedRectangleElement())
            }
          >
            <Square className="size-4" strokeWidth={1.8} />
            Rounded Rectangle
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => addElement(activeSlideId, createCircleElement())}
          >
            <Circle className="size-4" strokeWidth={1.8} />
            Circle
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button aria-label="Insert card" size="tool" variant="ghost">
                <LayoutGrid className="size-[18px]" strokeWidth={1.8} />
                Card
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Insert card</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="center" sideOffset={14}>
          {CARD_GRID_OPTIONS.map((columns) => (
            <DropdownMenuItem
              key={columns}
              onSelect={() =>
                addElements(activeSlideId, createCardGridElements(columns))
              }
            >
              <CardGridPreview columns={columns} />
              {columns} cards
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolButton
        aria-haspopup="dialog"
        caption="Timeline"
        label="Insert timeline"
        onClick={() => setIsTimelineOpen(true)}
      >
        <ChartGantt className="size-[18px]" strokeWidth={1.8} />
      </ToolButton>
      {isTimelineOpen ? (
        <TimelineGeneratorDialog onClose={closeTimeline} />
      ) : null}
      <ToolButton
        aria-haspopup="dialog"
        caption="Scope"
        label="Insert scope of work"
        onClick={() => setIsScopeOfWorkOpen(true)}
      >
        <ClipboardList className="size-[18px]" strokeWidth={1.8} />
      </ToolButton>
      {isScopeOfWorkOpen ? (
        <ScopeOfWorkGeneratorDialog onClose={closeScopeOfWork} />
      ) : null}
      <ToolButton
        aria-haspopup="dialog"
        caption="Mockup"
        label="Insert device mockup"
        onClick={() => setIsMockupOpen(true)}
      >
        <Smartphone className="size-[18px]" strokeWidth={1.8} />
      </ToolButton>
      {isMockupOpen ? <MockupDialog onClose={closeMockup} /> : null}
      <BackgroundPicker />
    </div>
  );
}
