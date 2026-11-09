"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { GeneratorDialog, generatorInputClassName } from "@/components/editor/generator-dialog";
import { Button } from "@/components/ui/button";
import {
  createTimelineGraphicPreview,
  estimateTimelineText,
  getDynamicTimelineErrors,
  type MeasureTimelineText,
} from "@/lib/timeline/timeline-component-elements";
import { addDaysToDateInput, todayDateInput } from "@/lib/timeline/timeline-dates";
import {
  cloneTimeline,
  createTimelinePhase,
  getTimelinePhaseLimit,
  getTimelineRange,
} from "@/lib/timeline/timeline-model";
import { getCanvasFont, measureTextWidth } from "@/lib/text/measure-text";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor-store";
import type { TimelineData, TimelineEditorSession, TimelinePhase } from "@/types/timeline";

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

export function TimelineEditorDialog({ session }: { session: TimelineEditorSession }) {
  const [data, setData] = useState(() => cloneTimeline(session.initialData));
  const [fontReady, setFontReady] = useState(false);
  const close = useEditorStore((state) => state.closeTimelineEditor);
  const save = useEditorStore((state) => state.saveTimeline);
  const previous = useEditorStore((state) => state.presentation.slides.find((slide) => slide.id === session.slideId));
  const editing = session.timelineId !== null;
  const component = data.placement === "component";

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      document.fonts.load(getCanvasFont("Plus Jakarta Sans", 24, 400)),
      document.fonts.load(getCanvasFont("Plus Jakarta Sans", 36, 700)),
    ]).then(() => { if (mounted) setFontReady(true); });
    return () => { mounted = false; };
  }, []);

  const measure = useMemo<MeasureTimelineText>(() => (text, size, weight = 400, spacing = 0) => {
    const width = fontReady ? measureTextWidth(text, "Plus Jakarta Sans", size, weight >= 600 ? 700 : 400) : null;
    return width === null
      ? estimateTimelineText(text, size, weight, spacing)
      : width + Math.max(0, Array.from(text).length - 1) * spacing;
  }, [fontReady]);
  const errors = useMemo(() => getDynamicTimelineErrors(data, measure), [data, measure]);
  const preview = useMemo(() => createTimelineGraphicPreview(data, measure, previous?.background, previous?.darkMode), [data, measure, previous?.background, previous?.darkMode]);
  const update = (updates: Partial<TimelineData>) => setData((current) => ({ ...current, ...updates }));
  const updatePhase = (id: string, updates: Partial<TimelinePhase>) => setData((current) => ({
    ...current,
    phases: current.phases.map((phase) => phase.id === id ? { ...phase, ...updates } : phase),
  }));
  const movePhase = (index: number, direction: -1 | 1) => setData((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.phases.length) return current;
    const phases = [...current.phases];
    [phases[index], phases[target]] = [phases[target], phases[index]];
    return { ...current, phases };
  });
  const addPhase = () => setData((current) => {
    if (current.phases.length >= getTimelinePhaseLimit(current.variant)) return current;
    const start = addDaysToDateInput(current.phases.at(-1)?.end || todayDateInput(), 1);
    return { ...current, phases: [...current.phases, createTimelinePhase(start, addDaysToDateInput(start, 6))] };
  });
  const limit = getTimelinePhaseLimit(data.variant);
  const hasErrors = Object.keys(errors).length > 0;
  const missingTarget = editing
    ? !previous?.timelines?.some((timeline) => timeline.id === session.timelineId)
    : !previous;

  return (
    <GeneratorDialog
      closeLabel="Close timeline editor"
      description="Edit the phases and dates in this graphic."
      insertDisabled={!fontReady || hasErrors || Boolean(missingTarget)}
      insertLabel={editing ? "Update timeline" : "Insert timeline"}
      onClose={close}
      onInsert={() => save(data, measure)}
      previewEmptyMessage="Add a phase to see the preview."
      previewNote={!fontReady ? "Loading fonts…" : editing ? "Update changes this graphic. Edit the slide title and introduction directly on the canvas." : "Inserted on the current slide. You can edit the phases and position again anytime."}
      previewSlide={preview}
      title={editing ? "Edit timeline" : "Create timeline"}
    >
      {!component ? (
        <fieldset className="space-y-3 rounded-2xl border border-stroke-01 p-3">
          <legend className="px-1 text-xs font-semibold text-primary">Date labels</legend>
          <Field label="Phase date labels">
            <select className={generatorInputClassName} onChange={(event) => update({ periodFormat: event.target.value as TimelineData["periodFormat"] })} value={data.periodFormat}>
              <option value="weeks">Weeks · Week 1–2</option>
              <option value="dates">Dates · 5 Jan – 18 Jan</option>
              <option value="months">Months · Jan – Feb</option>
            </select>
          </Field>
        </fieldset>
      ) : (
        <fieldset className="space-y-2 rounded-2xl border border-stroke-01 p-3">
          <legend className="px-1 text-xs font-semibold text-primary">Position on slide</legend>
          <div className="grid grid-cols-2 gap-2">
            <Field label="X · horizontal">
              <input className={generatorInputClassName} max={419} min={0} onChange={(event) => update({ position: { ...data.position, x: Number(event.target.value) || 0 } })} type="number" value={data.position.x} />
            </Field>
            <Field label="Y · vertical">
              <input className={generatorInputClassName} max={408} min={0} onChange={(event) => update({ position: { ...data.position, y: Number(event.target.value) || 0 } })} type="number" value={data.position.y} />
            </Field>
          </div>
          {errors.position ? <p className="text-[11px] text-destructive" role="alert">{errors.position}</p> : null}
        </fieldset>
      )}

      <div className="flex items-center justify-between px-1 pb-1 pt-2">
        <h3 className="text-xs font-semibold text-primary">Phases</h3>
        <span className="text-[11px] text-muted-foreground">{data.phases.length} / {limit} · {getTimelineRange(data).weeks} weeks</span>
      </div>
      {errors.phases ? <p className="px-1 text-[11px] leading-4 text-destructive" role="alert">{errors.phases}</p> : null}
      {data.phases.map((phase, index) => {
        const phaseHasError = fontReady && Object.keys(errors).some((key) => key.startsWith(`${phase.id}.`));
        return (
          <fieldset className={cn("space-y-3 rounded-2xl border p-3", phaseHasError ? "border-destructive/40 bg-[#fff6f4]" : "border-stroke-01 bg-surface-01")} key={phase.id}>
            <legend className="sr-only">Phase {index + 1}</legend>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">Phase {String(index + 1).padStart(2, "0")}</span>
              <div className="flex gap-0.5">
                <Button aria-label={`Move phase ${index + 1} up`} disabled={index === 0} onClick={() => movePhase(index, -1)} size="icon-sm" variant="ghost"><ArrowUp className="size-3.5" /></Button>
                <Button aria-label={`Move phase ${index + 1} down`} disabled={index === data.phases.length - 1} onClick={() => movePhase(index, 1)} size="icon-sm" variant="ghost"><ArrowDown className="size-3.5" /></Button>
                <Button aria-label={`Remove phase ${index + 1}`} className="text-muted-foreground hover:text-destructive" disabled={data.phases.length === 1} onClick={() => setData((current) => ({ ...current, phases: current.phases.filter(({ id }) => id !== phase.id) }))} size="icon-sm" variant="ghost"><Trash2 className="size-3.5" /></Button>
              </div>
            </div>
            <Field label="Phase title" error={fontReady ? errors[`${phase.id}.title`] : undefined}>
              <input aria-invalid={Boolean(errors[`${phase.id}.title`])} className={generatorInputClassName} maxLength={80} onChange={(event) => updatePhase(phase.id, { title: event.target.value })} placeholder="e.g. Design" value={phase.title} />
            </Field>
            {data.variant === "road" || data.variant === "steps" ? (
              <Field label="Description · optional" error={fontReady ? errors[`${phase.id}.description`] : undefined}>
                <textarea className={textareaClassName} maxLength={300} onChange={(event) => updatePhase(phase.id, { description: event.target.value })} placeholder="A short description of this phase" rows={2} value={phase.description} />
                {data.variant === "steps" && index === 0 ? <span className="block text-[10px] leading-4">The first step uses a compact layout. Its description is saved but is not displayed.</span> : null}
              </Field>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start date">
                <input className={generatorInputClassName} onChange={(event) => updatePhase(phase.id, { start: event.target.value })} type="date" value={phase.start} />
              </Field>
              <Field label="End date">
                <input className={generatorInputClassName} min={phase.start || undefined} onChange={(event) => updatePhase(phase.id, { end: event.target.value })} type="date" value={phase.end} />
              </Field>
            </div>
            {errors[`${phase.id}.dates`] ? <p className="text-[11px] leading-4 text-destructive" role="alert">{errors[`${phase.id}.dates`]}</p> : null}
          </fieldset>
        );
      })}
      <Button className="w-full shrink-0" disabled={data.phases.length >= limit} onClick={addPhase} variant="outline">
        <Plus className="size-4" />{data.phases.length >= limit ? `Maximum ${limit} phases` : "Add phase"}
      </Button>
      {fontReady && hasErrors ? <p className="px-1 text-[11px] leading-4 text-destructive" role="status">Adjust the highlighted fields to fit the selected design.</p> : null}
    </GeneratorDialog>
  );
}
