"use client";

import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createTextElement } from "@/lib/elements/create-element";
import { isHorizontalTextBlock, TEXT_BLOCK_TEMPLATES } from "@/lib/text/text-block";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor-store";
import type { TextBlockTemplate } from "@/types/text-block";

function TemplatePreview({ template }: { template: TextBlockTemplate | "basic" }) {
  const horizontal = template !== "basic" && isHorizontalTextBlock(template);
  const reverse = template === "body-title" || template === "body-beside-title";
  return (
    <div aria-hidden="true" className={cn("flex h-24 w-full items-start justify-center gap-2 overflow-hidden rounded-lg border border-stroke-01 bg-surface-01 p-3", horizontal ? reverse ? "flex-row-reverse" : "flex-row" : reverse ? "flex-col-reverse" : "flex-col")}>
      <span className={cn("font-semibold leading-[1.05] tracking-[-0.04em] text-primary", horizontal ? "w-[43%] shrink-0 text-[19px]" : template === "title" || template === "basic" ? "text-[28px]" : "text-[22px]")}>
        {template === "basic" ? "Text" : "A clear title"}
      </span>
      {template !== "title" && template !== "basic" ? (
        <span className={cn("flex flex-col gap-1.5 pt-1", horizontal ? "min-w-0 flex-1" : "w-full")}>
          {["w-full", "w-full", "w-4/5", "w-3/5"].map((width, index) => <span className={cn("block h-[3px] rounded-full bg-[#B5B5B5]", width)} key={index} />)}
        </span>
      ) : null}
    </div>
  );
}

export function TextTemplatePicker() {
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const addElement = useEditorStore((state) => state.addElement);
  const insertTextBlock = useEditorStore((state) => state.insertTextBlock);
  const itemClassName = "min-w-0 flex-col items-stretch gap-2 rounded-xl bg-surface-03 p-1.5 focus:bg-surface-03 data-[highlighted]:bg-surface-03 data-[highlighted]:shadow-[0_0_0_1.5px_#7b7b7b_inset,0_0_0_4px_#fcfcfc_inset]";
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild><Button aria-label="Insert text or text template" size="tool" variant="ghost"><Type className="size-[18px]" strokeWidth={1.8} />Text</Button></DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Insert text or text template</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="center" className="w-[580px] p-3" sideOffset={14}>
        <div className="px-1 pb-3 pt-1">
          <p className="text-[14px] font-semibold tracking-[-0.02em] text-primary">Text templates</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Choose a combination, then double-click its text to edit.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <DropdownMenuItem className={itemClassName} onSelect={() => addElement(activeSlideId, createTextElement())}>
            <TemplatePreview template="basic" />
            <span className="px-1 text-[11px] font-semibold text-primary">Basic text</span>
            <span className="px-1 pb-1 text-[10px] leading-4 text-muted-foreground">A free text box</span>
          </DropdownMenuItem>
          {TEXT_BLOCK_TEMPLATES.map((template) => (
            <DropdownMenuItem aria-label={`Insert ${template.name}`} className={itemClassName} key={template.id} onSelect={() => insertTextBlock(activeSlideId, template.id)}>
              <TemplatePreview template={template.id} />
              <span className="px-1 text-[11px] font-semibold text-primary">{template.name}</span>
              <span className="px-1 pb-1 text-[10px] leading-4 text-muted-foreground">{template.description}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
