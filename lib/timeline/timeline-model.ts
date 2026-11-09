import { createUniqueId } from "@/lib/id";
import {
  addDaysToDateInput,
  MAX_TIMELINE_PHASES,
  parseDateInput,
} from "@/lib/timeline/timeline-dates";
import type { TimelineData, TimelinePhase, TimelineVariant } from "@/types/timeline";

const MS_PER_DAY = 86_400_000;

export const TIMELINE_VARIANTS: readonly {
  id: TimelineVariant;
  layoutId?: string;
  name: string;
  description: string;
  maxPhases: number;
}[] = [
  { id: "road", layoutId: "wknd-timeline-road", name: "Road", description: "Milestones on a path", maxPhases: 5 },
  { id: "steps", layoutId: "wknd-timeline-steps", name: "Steps", description: "Phases that build up", maxPhases: 5 },
  { id: "roadmap", layoutId: "wknd-timeline-roadmap", name: "Roadmap", description: "Dates & quarters", maxPhases: 6 },
  { id: "bars", name: "Bars", description: "Date-based bars", maxPhases: MAX_TIMELINE_PHASES },
];

export function getTimelineVariantForLayout(layoutId: string) {
  return TIMELINE_VARIANTS.find((variant) => variant.layoutId === layoutId)?.id;
}

export function getTimelinePhaseLimit(variant: TimelineVariant) {
  return TIMELINE_VARIANTS.find((item) => item.id === variant)?.maxPhases ?? 5;
}

export function createTimelinePhase(start: string, end: string, id = createUniqueId("element")): TimelinePhase {
  return { id, title: "", description: "", start, end };
}

export function createDefaultTimeline(
  variant: TimelineVariant,
  id = createUniqueId("component"),
  start = "2026-01-05",
): TimelineData {
  const milestones = [
    { title: "Discovery", description: "Research, stakeholder interviews and brand audit", offset: 0, days: 14 },
    { title: "Strategy", description: "Positioning, goals and creative direction", offset: 14, days: 14 },
    { title: "Design", description: "Concepts, UI design and prototyping", offset: 28, days: 28 },
    { title: "Development", description: "Build, integration and QA testing", offset: 56, days: 28 },
    { title: "Launch", description: "Go-live, handover and optimisation", offset: 84, days: 7 },
  ];
  const bars = [
    { title: "Design", offset: 0, days: 7 },
    { title: "Frontend", offset: 7, days: 7 },
    { title: "Backend", offset: 7, days: 28 },
    { title: "QA", offset: 28, days: 14 },
    { title: "Go Live", offset: 42, days: 7 },
  ];
  const roadmapDates = [
    ["2026-01-01", "2026-02-28"],
    ["2026-02-15", "2026-05-15"],
    ["2026-04-15", "2026-08-31"],
    ["2026-08-01", "2026-11-30"],
    ["2026-11-01", "2026-12-31"],
  ];
  return {
    version: 1,
    id,
    variant,
    placement: variant === "bars" ? "component" : "slide",
    graphicsOnly: true,
    label: "Timeline",
    title: variant === "road" ? "The road\nto launch." : variant === "steps" ? "Step by Step" : variant === "roadmap" ? "Roadmap 2026" : "Project timeline",
    autoTitle: variant === "roadmap",
    introMode: "auto",
    intro: "",
    periodFormat: variant === "roadmap" ? "months" : "weeks",
    position: { x: 200, y: 240 },
    phases: milestones.map((phase, index) => {
      const item = variant === "bars" ? bars[index] : phase;
      return {
        ...createTimelinePhase(
          variant === "roadmap" ? roadmapDates[index][0] : addDaysToDateInput(start, item.offset),
          variant === "roadmap" ? roadmapDates[index][1] : addDaysToDateInput(start, item.offset + item.days - 1),
          `${id}-phase-${index + 1}`,
        ),
        title: item.title,
        description: variant === "bars" ? "" : phase.description,
      };
    }),
  };
}

export function cloneTimeline(data: TimelineData, freshIds = false): TimelineData {
  return {
    ...data,
    id: freshIds ? createUniqueId("component") : data.id,
    position: { ...data.position },
    phases: data.phases.map((phase) => ({ ...phase, id: freshIds ? createUniqueId("element") : phase.id })),
  };
}

export function getTimelineRange(data: TimelineData) {
  const ranges = data.phases.flatMap((phase) => {
    const start = parseDateInput(phase.start);
    const end = parseDateInput(phase.end);
    return start !== null && end !== null && end >= start ? [{ start, end }] : [];
  });
  const start = ranges.length ? Math.min(...ranges.map((range) => range.start)) : parseDateInput("2026-01-01")!;
  const end = ranges.length ? Math.max(...ranges.map((range) => range.end)) : start + 6;
  return { start, end, weeks: Math.max(1, Math.ceil((end - start + 1) / 7)) };
}

export function getTimelinePeriod(data: TimelineData, phase: TimelinePhase) {
  const start = parseDateInput(phase.start);
  const end = parseDateInput(phase.end);
  if (start === null || end === null || end < start) return "";
  if (data.periodFormat === "weeks") {
    const anchor = getTimelineRange(data).start;
    const first = Math.floor((start - anchor) / 7) + 1;
    const last = Math.floor((end - anchor) / 7) + 1;
    return first === last ? `Week ${first}` : `Week ${first}–${last}`;
  }
  const firstDate = new Date(start * MS_PER_DAY);
  const lastDate = new Date(end * MS_PER_DAY);
  const sameYear = firstDate.getUTCFullYear() === lastDate.getUTCFullYear();
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    ...(data.periodFormat === "dates" ? { day: "numeric" as const } : {}),
    ...(!sameYear ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  };
  const formatter = new Intl.DateTimeFormat("en-GB", options);
  const from = formatter.format(firstDate);
  const to = formatter.format(lastDate);
  return from === to ? from : `${from} – ${to}`;
}

export function getTimelineIntro(data: TimelineData) {
  if (data.introMode === "custom") return data.intro.trim();
  if (data.variant === "road") return `A ${getTimelineRange(data).weeks}-week journey from first insight\nto launch day.`;
  if (data.variant === "steps") {
    const count = ["zero", "one", "two", "three", "four", "five"][data.phases.length] ?? String(data.phases.length);
    return `Every phase builds on the last — ${count} ${data.phases.length === 1 ? "step" : "steps"}\nto launch.`;
  }
  return "From discovery to launch in one quarter-by-quarter view.";
}

export function getTimelineTitle(data: TimelineData) {
  if (data.variant !== "roadmap" || !data.autoTitle) return data.title.trim();
  const range = getTimelineRange(data);
  const first = new Date(range.start * MS_PER_DAY).getUTCFullYear();
  const last = new Date(range.end * MS_PER_DAY).getUTCFullYear();
  return first === last ? `Roadmap ${first}` : `Roadmap ${first}–${last}`;
}

export function isTimelineData(value: unknown): value is TimelineData {
  if (typeof value !== "object" || value === null) return false;
  const data = value as Record<string, unknown>;
  if (
    data.version !== 1 || typeof data.id !== "string" || !data.id ||
    !TIMELINE_VARIANTS.some((variant) => variant.id === data.variant) ||
    (data.placement !== "slide" && data.placement !== "component") ||
    (data.variant === "bars") !== (data.placement === "component") ||
    (data.graphicsOnly !== undefined && data.graphicsOnly !== true) ||
    !["label", "title", "intro"].every((key) => typeof data[key] === "string") ||
    (data.autoTitle !== undefined && typeof data.autoTitle !== "boolean") ||
    (data.introMode !== "auto" && data.introMode !== "custom") ||
    !["weeks", "dates", "months"].includes(String(data.periodFormat)) ||
    typeof data.position !== "object" || data.position === null ||
    !Array.isArray(data.phases) || data.phases.length < 1 || data.phases.length > MAX_TIMELINE_PHASES
  ) return false;
  const position = data.position as Record<string, unknown>;
  if (typeof position.x !== "number" || !Number.isFinite(position.x) || typeof position.y !== "number" || !Number.isFinite(position.y)) return false;
  const ids = new Set<string>();
  return data.phases.every((value: unknown) => {
    if (typeof value !== "object" || value === null) return false;
    const phase = value as Record<string, unknown>;
    if (
      typeof phase.id !== "string" || !phase.id || ids.has(phase.id) ||
      !["title", "description", "start", "end"].every((key) => typeof phase[key] === "string")
    ) return false;
    ids.add(phase.id);
    return true;
  });
}
