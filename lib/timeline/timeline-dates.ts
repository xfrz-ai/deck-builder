import type { TimelineModel } from "@/lib/timeline/timeline-elements";

export interface TimelinePhaseInput {
  id: string;
  title: string;
  // `YYYY-MM-DD` values from `<input type="date">`.
  start: string;
  end: string;
}

export const MAX_TIMELINE_PHASES = 10;
// Longer timelines group several weeks per column to stay readable.
const MAX_TIMELINE_COLUMNS = 16;
const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
// Days since the Unix epoch in UTC, so time zones never shift a date.
export function parseDateInput(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match.map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.getTime() / MS_PER_DAY
    : null;
}

export function formatDateInput(day: number) {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function todayDateInput() {
  const now = new Date();
  return formatDateInput(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / MS_PER_DAY,
  );
}

export function addDaysToDateInput(value: string, days: number) {
  const day = parseDateInput(value);
  return day === null ? value : formatDateInput(day + days);
}

export function getTimelinePhaseError(phase: TimelinePhaseInput) {
  if (!phase.title.trim()) {
    return "Add a title for this phase.";
  }

  const start = parseDateInput(phase.start);
  const end = parseDateInput(phase.end);

  if (start === null || end === null) {
    return "Choose a start and end date.";
  }

  if (end < start) {
    return "End date must be on or after the start date.";
  }

  return null;
}

// W1 is the week the first phase starts in; grouped columns read "W1–2".
function getWeekLabel(column: number, weeksPerColumn: number) {
  const firstWeek = column * weeksPerColumn + 1;

  return weeksPerColumn === 1
    ? `W${firstWeek}`
    : `W${firstWeek}–${firstWeek + weeksPerColumn - 1}`;
}

// Builds week columns that cover every phase, with bars positioned
// proportionally to their dates. Invalid phases are skipped.
export function createTimelineModelFromPhases(
  phases: readonly TimelinePhaseInput[],
): TimelineModel | null {
  const ranges = phases.flatMap((phase) => {
    if (getTimelinePhaseError(phase)) {
      return [];
    }

    return [
      {
        label: phase.title.trim(),
        start: parseDateInput(phase.start) as number,
        // Inclusive end date: the bar covers the whole last day.
        end: (parseDateInput(phase.end) as number) + 1,
      },
    ];
  });

  if (ranges.length === 0) {
    return null;
  }

  const rangeStart = Math.min(...ranges.map((range) => range.start));
  const rangeEnd = Math.max(...ranges.map((range) => range.end));
  const weeksPerColumn = Math.ceil(
    Math.ceil((rangeEnd - rangeStart) / DAYS_PER_WEEK) / MAX_TIMELINE_COLUMNS,
  );
  const step = weeksPerColumn * DAYS_PER_WEEK;
  const columnCount = Math.ceil((rangeEnd - rangeStart) / step);
  const columnDates = Array.from(
    { length: columnCount },
    (_, index) => new Date((rangeStart + index * step) * MS_PER_DAY),
  );
  const spansYears =
    columnDates[0].getUTCFullYear() !==
    new Date((rangeEnd - 1) * MS_PER_DAY).getUTCFullYear();

  const months = columnDates.flatMap((date, index) => {
    const previous = columnDates[index - 1];

    if (
      previous &&
      previous.getUTCMonth() === date.getUTCMonth() &&
      previous.getUTCFullYear() === date.getUTCFullYear()
    ) {
      return [];
    }

    const name = MONTH_NAMES[date.getUTCMonth()];
    return [
      {
        column: index,
        label: spansYears ? `${name} ${date.getUTCFullYear()}` : name,
      },
    ];
  });

  return {
    columns: columnDates.map((_, index) => getWeekLabel(index, weeksPerColumn)),
    months,
    bars: ranges.map((range) => ({
      label: range.label,
      start: (range.start - rangeStart) / step,
      end: (range.end - rangeStart) / step,
    })),
  };
}
