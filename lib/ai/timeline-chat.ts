import { describeErrors, isRecord, text } from "@/lib/ai/bridge-client";
import { createUniqueId } from "@/lib/id";
import { getTimelinePhaseLimit } from "@/lib/timeline/timeline-model";
import type { TimelineData, TimelinePhase } from "@/types/timeline";

// What the AI sees of a timeline. Its title and intro live on the canvas and
// its position belongs to the layout, so only the phases are editable here.
export interface TimelineContent {
  variant: TimelineData["variant"];
  maxPhases: number;
  periodFormat: TimelineData["periodFormat"];
  phases: TimelinePhase[];
}

const PERIOD_FORMATS: readonly TimelineData["periodFormat"][] = ["weeks", "dates", "months"];

export function toTimelineContent(timeline: TimelineData): TimelineContent {
  return {
    variant: timeline.variant,
    maxPhases: getTimelinePhaseLimit(timeline.variant),
    periodFormat: timeline.periodFormat,
    phases: timeline.phases.map((phase) => ({ ...phase })),
  };
}

// Builds the next TimelineData from the AI's proposal, keeping the ids of
// phases that still exist. Returns an error message when the shape is wrong.
export function mergeTimelineContent(original: TimelineData, proposal: unknown): TimelineData | string {
  if (!isRecord(proposal) || !Array.isArray(proposal.phases)) {
    return "The proposal must be an object with a phases array.";
  }

  const originalPhases = new Set(original.phases.map((phase) => phase.id));
  const usedIds = new Set<string>();
  const phases: TimelinePhase[] = [];
  for (const raw of proposal.phases) {
    if (!isRecord(raw)) return "Every phase must be an object.";
    const requestedId = text(raw.id);
    const keep = originalPhases.has(requestedId) && !usedIds.has(requestedId);
    const id = keep ? requestedId : createUniqueId("element");
    usedIds.add(id);
    phases.push({
      id,
      title: text(raw.title),
      description: text(raw.description),
      start: text(raw.start),
      end: text(raw.end),
    });
  }

  const periodFormat = PERIOD_FORMATS.find((format) => format === proposal.periodFormat) ?? original.periodFormat;
  return { ...original, periodFormat, phases };
}

export function describeTimelineErrors(timeline: TimelineData, errors: Record<string, string>) {
  const labels = new Map<string, string>([["phases", "Phases"]]);
  timeline.phases.forEach((phase, index) => {
    labels.set(phase.id, `Phase ${index + 1} "${phase.title}"`);
  });
  return describeErrors(labels, errors);
}
