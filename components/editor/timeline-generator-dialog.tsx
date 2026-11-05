"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";

import {
  GENERATOR_PREVIEW_BACKGROUND,
  GeneratorDialog,
  generatorInputClassName,
} from "@/components/editor/generator-dialog";
import { Button } from "@/components/ui/button";
import { createUniqueId } from "@/lib/id";
import {
  addDaysToDateInput,
  createTimelineModelFromPhases,
  getTimelinePhaseError,
  MAX_TIMELINE_PHASES,
  type TimelinePhaseInput,
  todayDateInput,
} from "@/lib/timeline/timeline-dates";
import { createTimelineElements } from "@/lib/timeline/timeline-elements";
import { cn } from "@/lib/utils";
import { selectActiveSlide, useEditorStore } from "@/store/editor-store";
import type { Slide } from "@/types/presentation";

const DEFAULT_PHASES: readonly {
  title: string;
  offset: number;
  days: number;
}[] = [
  { title: "Design", offset: 0, days: 7 },
  { title: "Frontend", offset: 7, days: 7 },
  { title: "Backend", offset: 7, days: 28 },
  { title: "QA", offset: 28, days: 14 },
  { title: "Go Live", offset: 42, days: 7 },
];

function createPhase(
  title: string,
  start: string,
  end: string,
): TimelinePhaseInput {
  return { id: createUniqueId("element"), title, start, end };
}

function createDefaultPhases() {
  const today = todayDateInput();

  return DEFAULT_PHASES.map(({ days, offset, title }) =>
    createPhase(
      title,
      addDaysToDateInput(today, offset),
      addDaysToDateInput(today, offset + days - 1),
    ),
  );
}

interface TimelineGeneratorDialogProps {
  onClose: () => void;
}

export function TimelineGeneratorDialog({
  onClose,
}: TimelineGeneratorDialogProps) {
  const fieldIdPrefix = useId();
  const [phases, setPhases] = useState(createDefaultPhases);
  const activeSlide = useEditorStore(selectActiveSlide);
  const addElements = useEditorStore((state) => state.addElements);

  const errors = phases.map(getTimelinePhaseError);
  const hasErrors = errors.some(Boolean);
  const model = useMemo(() => createTimelineModelFromPhases(phases), [phases]);
  const previewSlide = useMemo<Slide | null>(
    () =>
      model
        ? {
            id: "timeline-preview",
            background: GENERATOR_PREVIEW_BACKGROUND,
            elements: createTimelineElements(model, "timeline-preview"),
          }
        : null,
    [model],
  );

  const updatePhase = (
    phaseId: string,
    updates: Partial<Omit<TimelinePhaseInput, "id">>,
  ) =>
    setPhases((current) =>
      current.map((phase) =>
        phase.id === phaseId ? { ...phase, ...updates } : phase,
      ),
    );

  const addPhase = () =>
    setPhases((current) => {
      const lastEnd = current.at(-1)?.end ?? todayDateInput();
      const start = addDaysToDateInput(lastEnd, 1);

      return [
        ...current,
        createPhase(
          `Phase ${current.length + 1}`,
          start,
          addDaysToDateInput(start, 6),
        ),
      ];
    });

  const removePhase = (phaseId: string) =>
    setPhases((current) => current.filter((phase) => phase.id !== phaseId));

  const handleInsert = () => {
    if (!activeSlide || !model || hasErrors) {
      return;
    }

    addElements(
      activeSlide.id,
      createTimelineElements(model, createUniqueId("element")),
    );
    onClose();
  };

  return (
    <GeneratorDialog
      closeLabel="Close timeline generator"
      description="Add phases with their dates. The timeline uses the WKND style."
      insertDisabled={!activeSlide || !model || hasErrors}
      insertLabel="Insert timeline"
      onClose={onClose}
      onInsert={handleInsert}
      previewEmptyMessage="Fill in at least one phase to see the preview."
      previewNote="Inserted on the current slide. Columns and bar lengths follow your dates."
      previewSlide={previewSlide}
      title="Insert timeline"
    >
      {phases.map((phase, index) => {
        const error = errors[index];
        const fieldId = `${fieldIdPrefix}-${phase.id}`;

        return (
          <fieldset
            aria-label={`Phase ${index + 1}`}
            className={cn(
              "rounded-2xl border p-3 transition-colors",
              error
                ? "border-destructive/40 bg-[#fff6f4]"
                : "border-stroke-01 bg-surface-01",
            )}
            key={phase.id}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">
                Phase {index + 1}
              </span>
              <Button
                aria-label={`Remove phase ${index + 1}`}
                className="text-muted-foreground hover:text-destructive"
                disabled={phases.length === 1}
                onClick={() => removePhase(phase.id)}
                size="icon-sm"
                variant="ghost"
              >
                <Trash2 className="size-3.5" strokeWidth={1.8} />
              </Button>
            </div>

            <label
              className="mb-2 block space-y-1.5 text-[11px] font-medium text-muted-foreground"
              htmlFor={`${fieldId}-title`}
            >
              <span>Timeline title</span>
              <input
                className={generatorInputClassName}
                id={`${fieldId}-title`}
                maxLength={40}
                onChange={(event) =>
                  updatePhase(phase.id, { title: event.target.value })
                }
                placeholder="e.g. Design"
                value={phase.title}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label
                className="space-y-1.5 text-[11px] font-medium text-muted-foreground"
                htmlFor={`${fieldId}-start`}
              >
                <span>Start date</span>
                <input
                  className={generatorInputClassName}
                  id={`${fieldId}-start`}
                  onChange={(event) =>
                    updatePhase(phase.id, { start: event.target.value })
                  }
                  type="date"
                  value={phase.start}
                />
              </label>
              <label
                className="space-y-1.5 text-[11px] font-medium text-muted-foreground"
                htmlFor={`${fieldId}-end`}
              >
                <span>End date</span>
                <input
                  className={generatorInputClassName}
                  id={`${fieldId}-end`}
                  min={phase.start || undefined}
                  onChange={(event) =>
                    updatePhase(phase.id, { end: event.target.value })
                  }
                  type="date"
                  value={phase.end}
                />
              </label>
            </div>

            {error ? (
              <p className="mt-2 text-[11px] font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </fieldset>
        );
      })}

      <Button
        className="w-full"
        disabled={phases.length >= MAX_TIMELINE_PHASES}
        onClick={addPhase}
        variant="outline"
      >
        <Plus className="size-4" strokeWidth={2} />
        {phases.length >= MAX_TIMELINE_PHASES
          ? `Maximum ${MAX_TIMELINE_PHASES} phases`
          : "Add phase"}
      </Button>
    </GeneratorDialog>
  );
}
