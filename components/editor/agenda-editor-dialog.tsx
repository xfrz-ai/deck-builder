"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import {
  GeneratorDialog,
  generatorInputClassName,
} from "@/components/editor/generator-dialog";
import { Button } from "@/components/ui/button";
import {
  createAgendaGraphicPreview,
  estimateAgendaText,
  getAgendaErrors,
  type MeasureAgendaText,
} from "@/lib/agenda/agenda-elements";
import {
  cloneAgenda,
  createAgendaItem,
  formatAgendaTime,
  getAgendaActiveItemId,
  getAgendaDuration,
  MAX_AGENDA_ITEMS,
  parseAgendaTime,
} from "@/lib/agenda/agenda-model";
import { getCanvasFont, measureTextWidth } from "@/lib/text/measure-text";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor-store";
import type { AgendaEditorSession, AgendaItem } from "@/types/agenda";

const textareaClassName = `${generatorInputClassName} h-auto min-h-16 resize-y py-2 leading-5`;

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-[11px] font-medium text-muted-foreground">
      <span className="block">{label}</span>
      {children}
      {error ? <span className="block leading-4 text-destructive" role="alert">{error}</span> : null}
    </label>
  );
}

export function AgendaEditorDialog({ session }: { session: AgendaEditorSession }) {
  const [data, setData] = useState(() => cloneAgenda(session.initialData));
  const [fontReady, setFontReady] = useState(false);
  const close = useEditorStore((state) => state.closeAgendaEditor);
  const save = useEditorStore((state) => state.saveAgenda);
  const previous = useEditorStore((state) => state.presentation.slides.find((slide) => slide.id === session.slideId));

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      document.fonts.load(getCanvasFont("Plus Jakarta Sans", 24, 400)),
      document.fonts.load(getCanvasFont("Plus Jakarta Sans", 53, 700)),
    ]).then(() => {
      if (mounted) setFontReady(true);
    });
    return () => { mounted = false; };
  }, []);

  const measure = useMemo<MeasureAgendaText>(() => (text, size, weight = 400, spacing = 0) => {
    // Canvas text renders semibold and bold with Konva's bold font style.
    const width = fontReady ? measureTextWidth(text, "Plus Jakarta Sans", size, weight >= 600 ? 700 : 400) : null;
    return width === null
      ? estimateAgendaText(text, size, weight, spacing)
      : width + Math.max(0, Array.from(text).length - 1) * spacing;
  }, [fontReady]);
  const errors = useMemo(() => getAgendaErrors(data, measure), [data, measure]);
  const preview = useMemo(() => createAgendaGraphicPreview(data, measure, previous?.background, previous?.darkMode), [data, measure, previous?.background, previous?.darkMode]);
  const updateStartTime = (startTime: string) => setData((current) => ({ ...current, startTime }));
  const updateItem = (id: string, updates: Partial<AgendaItem>) => setData((current) => ({
    ...current,
    items: current.items.map((item) => item.id === id ? { ...item, ...updates } : item),
  }));
  const moveItem = (index: number, direction: -1 | 1) => setData((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.items.length) return current;
    const items = [...current.items];
    [items[index], items[target]] = [items[target], items[index]];
    return { ...current, items };
  });
  const selectActiveItem = (id: string) => setData((current) => ({
    ...current,
    items: current.items.map((item) => ({ ...item, highlighted: item.id === id })),
  }));
  const removeItem = (id: string) => setData((current) => {
    if (current.items.length <= 1) return current;
    const index = current.items.findIndex((item) => item.id === id);
    let items = current.items.filter((item) => item.id !== id);
    if (current.variant === "spotlight" && getAgendaActiveItemId(current) === id) {
      const nextId = items[Math.min(index, items.length - 1)]?.id;
      items = items.map((item) => ({ ...item, highlighted: item.id === nextId }));
    }
    return { ...current, items };
  });
  const duration = getAgendaDuration(data);
  const start = parseAgendaTime(data.startTime);
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <GeneratorDialog
      closeLabel="Close agenda editor"
      description="Edit the agenda graphic and its items."
      insertDisabled={!fontReady || hasErrors || !previous?.agenda}
      insertLabel="Update agenda"
      onClose={close}
      onInsert={() => save(data, measure)}
      previewEmptyMessage="Add an agenda item to see the preview."
      previewNote={!fontReady ? "Loading fonts…" : "Update changes the agenda graphic. Edit slide text directly on the canvas."}
      previewSlide={preview}
      title="Edit agenda"
    >
      {data.variant === "schedule" ? (
        <fieldset className="space-y-3 rounded-2xl border border-stroke-01 p-3">
          <legend className="px-1 text-xs font-semibold text-primary">Schedule</legend>
          <Field label="Start time" error={errors.startTime}>
            <input className={generatorInputClassName} onChange={(event) => updateStartTime(event.target.value)} type="time" value={data.startTime} />
          </Field>
          <p className="text-[11px] leading-4 text-muted-foreground">{start !== null && start + duration < 1440 ? `Ends at ${formatAgendaTime(start + duration)} · ${duration} minutes total` : "The schedule must start and end on the same day."}</p>
        </fieldset>
      ) : null}

      {data.variant === "spotlight" ? (
        <fieldset className="space-y-3 rounded-2xl border border-stroke-01 p-3">
          <legend className="px-1 text-xs font-semibold text-primary">Current topic</legend>
          <Field label="Active topic" error={errors.activeItem}>
            <select className={generatorInputClassName} onChange={(event) => selectActiveItem(event.target.value)} value={getAgendaActiveItemId(data) ?? ""}>
              {data.items.map((item, index) => (
                <option key={item.id} value={item.id}>{String(index + 1).padStart(2, "0")} · {item.title.trim() || "Untitled topic"}</option>
              ))}
            </select>
          </Field>
          <p className="text-[11px] leading-4 text-muted-foreground">The active topic has an orange number, a larger title and its description. Other topics stay dimmed.</p>
        </fieldset>
      ) : null}

      <div className="flex items-center justify-between px-1 pb-1 pt-2">
        <h3 className="text-xs font-semibold text-primary">Agenda items</h3>
        <span className="text-[11px] text-muted-foreground">{data.items.length} / {MAX_AGENDA_ITEMS}</span>
      </div>
      {data.items.map((item, index) => {
        const itemHasError = fontReady && Object.keys(errors).some((key) => key.startsWith(`${item.id}.`));
        return (
          <fieldset className={cn("space-y-3 rounded-2xl border p-3", itemHasError ? "border-destructive/40 bg-[#fff6f4]" : "border-stroke-01 bg-surface-01")} key={item.id}>
            <legend className="sr-only">Agenda item {index + 1}</legend>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">
                Item {String(index + 1).padStart(2, "0")}
                {data.variant === "spotlight" && item.id === getAgendaActiveItemId(data) ? <span className="ml-2 text-[10px] text-[#F13F00]">Active</span> : null}
              </span>
              <div className="flex gap-0.5">
                <Button aria-label={`Move item ${index + 1} up`} disabled={index === 0} onClick={() => moveItem(index, -1)} size="icon-sm" variant="ghost"><ArrowUp className="size-3.5" /></Button>
                <Button aria-label={`Move item ${index + 1} down`} disabled={index === data.items.length - 1} onClick={() => moveItem(index, 1)} size="icon-sm" variant="ghost"><ArrowDown className="size-3.5" /></Button>
                <Button aria-label={`Remove item ${index + 1}`} className="text-muted-foreground hover:text-destructive" disabled={data.items.length === 1} onClick={() => removeItem(item.id)} size="icon-sm" variant="ghost"><Trash2 className="size-3.5" /></Button>
              </div>
            </div>
            <Field label="Title" error={fontReady ? errors[`${item.id}.title`] : undefined}>
              <textarea aria-invalid={Boolean(errors[`${item.id}.title`])} className={textareaClassName} maxLength={160} onChange={(event) => updateItem(item.id, { title: event.target.value })} placeholder="e.g. Introduction" rows={2} value={item.title} />
            </Field>
            {data.variant === "cards" || data.variant === "spotlight" ? (
              <Field label="Description · optional" error={fontReady ? errors[`${item.id}.description`] : undefined}>
                <input className={generatorInputClassName} maxLength={200} onChange={(event) => updateItem(item.id, { description: event.target.value })} placeholder="A short description of this topic" value={item.description} />
                {data.variant === "spotlight" ? <span className="block text-[10px] leading-4">Shown only when this topic is active.</span> : null}
              </Field>
            ) : null}
            {data.variant === "chapters" ? (
              <Field label="Page number · optional" error={fontReady ? errors[`${item.id}.page`] : undefined}>
                <input className={generatorInputClassName} inputMode="numeric" maxLength={4} onChange={(event) => updateItem(item.id, { page: event.target.value })} placeholder="e.g. 3" value={item.page} />
              </Field>
            ) : null}
            {data.variant === "schedule" ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Duration · minutes" error={fontReady ? errors[`${item.id}.duration`] : undefined}>
                    <input className={generatorInputClassName} max={1439} min={1} onChange={(event) => updateItem(item.id, { durationMinutes: Number(event.target.value) || 0 })} step={1} type="number" value={item.durationMinutes || ""} />
                  </Field>
                  <Field label="Session type">
                    <select className={generatorInputClassName} onChange={(event) => updateItem(item.id, { kind: event.target.value as AgendaItem["kind"] })} value={item.kind}>
                      <option value="session">Session</option>
                      <option value="break">Break</option>
                    </select>
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                  <input checked={item.highlighted} className="size-3.5 accent-[#032ABF]" disabled={item.kind === "break"} onChange={(event) => updateItem(item.id, { highlighted: event.target.checked })} type="checkbox" />
                  Highlight this session in blue
                </label>
              </>
            ) : null}
          </fieldset>
        );
      })}
      {errors.items ? <p className="px-1 text-[11px] text-destructive" role="alert">{errors.items}</p> : null}
      <Button className="w-full shrink-0" disabled={data.items.length >= MAX_AGENDA_ITEMS} onClick={() => setData((current) => current.items.length < MAX_AGENDA_ITEMS ? { ...current, items: [...current.items, createAgendaItem()] } : current)} variant="outline">
        <Plus className="size-4" />
        {data.items.length >= MAX_AGENDA_ITEMS ? "Maximum 6 items" : "Add item"}
      </Button>
      {fontReady && hasErrors ? <p className="px-1 text-[11px] leading-4 text-destructive" role="status">Adjust the highlighted fields to fit the selected design.</p> : null}
    </GeneratorDialog>
  );
}
