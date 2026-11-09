"use client";

import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Pencil, Type } from "lucide-react";
import { NumericField, TextProperties } from "@/components/editor/panels/text-properties";
import { Button } from "@/components/ui/button";
import { getTextBlockBounds, minTextBlockWidth, TEXT_BLOCK_TEMPLATES } from "@/lib/text/text-block";
import { useEditorStore } from "@/store/editor-store";
import type { Slide, TextElement } from "@/types/presentation";
import type { TextBlockData, TextBlockLayoutUpdates } from "@/types/text-block";

export function TextBlockProperties({ block, slide }: { block: TextBlockData; slide: Slide }) {
  const updateLayout = useEditorStore((state) => state.updateTextBlockLayout);
  const startTextEditing = useEditorStore((state) => state.startTextEditing);
  const editingTextId = useEditorStore((state) => state.editingTextId);
  const selectedElementId = useEditorStore((state) => state.selectedElementIds[0]);
  const selectElement = useEditorStore((state) => state.selectElement);
  const formatPart = slide.elements.find((element) => element.id === selectedElementId && element.textBlockId === block.id)?.textBlockPart ?? "title";
  const editingPart = slide.elements.find((element) => element.id === editingTextId && element.textBlockId === block.id)?.textBlockPart;
  const part = editingPart ?? formatPart;
  const element = slide.elements.find((element): element is TextElement => element.type === "text" && element.textBlockId === block.id && element.textBlockPart === part);
  const update = (updates: TextBlockLayoutUpdates) => updateLayout(slide.id, block.id, updates);
  const alignment = !block.body || block.body.align === block.title.align ? block.title.align : undefined;
  return (
    <>
      <section className="shrink-0 space-y-3 border-b border-stroke-01 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary"><Type className="size-4" />Text component</div>
        <p className="text-[11px] text-muted-foreground">{TEXT_BLOCK_TEMPLATES.find((template) => template.id === block.template)?.name}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <NumericField key={`width-${block.width}`} label="Component width" min={minTextBlockWidth(block.template)} max={1800} value={block.width} onCommit={(width) => update({ width })} />
          {block.body ? <NumericField key={`gap-${block.gap}`} label="Text gap" min={0} max={240} value={block.gap} onCommit={(gap) => update({ gap })} /> : <span className="self-end pb-2 text-[11px] text-muted-foreground">Height {Math.round(getTextBlockBounds(block).height)} · auto</span>}
        </div>
        <div className="flex gap-1 rounded-xl bg-surface-03 p-1" role="group" aria-label="Component text alignment">
          {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight], ["justify", AlignJustify]] as const).map(([align, Icon]) => <Button className="flex-1" aria-label={`Align component ${align}`} aria-pressed={alignment === align} key={align} size="icon-sm" variant="ghost" onClick={() => update({ align })}><Icon className="size-3.5" /></Button>)}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <NumericField key={`x-${block.x}`} label="Component X" value={block.x} onCommit={(x) => update({ x })} />
          <NumericField key={`y-${block.y}`} label="Component Y" value={block.y} onCommit={(y) => update({ y })} />
        </div>
        {block.body ? <label className="block space-y-1.5 text-[11px] text-muted-foreground"><span className="block">Text to format</span><select aria-label="Text to format" className="h-9 w-full rounded-[10px] border border-stroke-01 bg-surface-03 px-2 text-xs text-primary outline-none" value={part} onChange={(event) => { const target = slide.elements.find((item) => item.textBlockId === block.id && item.textBlockPart === event.target.value); if (target) selectElement(target.id); }}><option value="title">Title</option><option value="body">Paragraph</option></select></label> : null}
        <Button className="w-full" variant="outline" onClick={() => { if (element) startTextEditing(element.id); }}><Pencil className="size-3.5" />Edit {part === "title" ? "title" : "paragraph"}</Button>
        <p className="text-[11px] leading-4 text-muted-foreground">Drag to move the combination. Double-click text to edit. Height and spacing follow your content.</p>
      </section>
      {element ? <TextProperties key={element.id} element={element} slideId={slide.id} hideLayoutControls /> : null}
    </>
  );
}
