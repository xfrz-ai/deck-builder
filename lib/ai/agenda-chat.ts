import { describeErrors, isRecord, text } from "@/lib/ai/bridge-client";
import { MAX_AGENDA_ITEMS } from "@/lib/agenda/agenda-model";
import { createUniqueId } from "@/lib/id";
import type { AgendaData, AgendaItem } from "@/types/agenda";

// What the AI sees of an agenda. The slide title and intro live on the
// canvas, so only the graphic's items and schedule are editable here.
export interface AgendaContent {
  variant: AgendaData["variant"];
  maxItems: number;
  date: string;
  location: string;
  startTime: string;
  items: AgendaItem[];
}

export function toAgendaContent(agenda: AgendaData): AgendaContent {
  return {
    variant: agenda.variant,
    maxItems: MAX_AGENDA_ITEMS,
    date: agenda.date,
    location: agenda.location,
    startTime: agenda.startTime,
    items: agenda.items.map((item) => ({ ...item })),
  };
}

// Builds the next AgendaData from the AI's proposal, keeping the ids of items
// that still exist. Returns an error message when the shape is wrong.
export function mergeAgendaContent(original: AgendaData, proposal: unknown): AgendaData | string {
  if (!isRecord(proposal) || !Array.isArray(proposal.items)) {
    return "The proposal must be an object with an items array.";
  }

  const originalItems = new Map(original.items.map((item) => [item.id, item]));
  const usedIds = new Set<string>();
  const items: AgendaItem[] = [];
  for (const raw of proposal.items) {
    if (!isRecord(raw)) return "Every agenda item must be an object.";
    const requestedId = text(raw.id);
    const existing = usedIds.has(requestedId) ? undefined : originalItems.get(requestedId);
    const id = existing ? requestedId : createUniqueId("element");
    usedIds.add(id);
    const duration = typeof raw.durationMinutes === "number" && Number.isFinite(raw.durationMinutes)
      ? Math.round(raw.durationMinutes)
      : existing?.durationMinutes ?? 30;
    items.push({
      id,
      // Schedule titles may break onto a second line on purpose.
      title: typeof raw.title === "string" ? raw.title.trim() : "",
      description: text(raw.description),
      page: typeof raw.page === "number" ? String(raw.page) : text(raw.page),
      durationMinutes: duration,
      kind: raw.kind === "break" ? "break" : "session",
      highlighted: raw.highlighted === true,
    });
  }

  return {
    ...original,
    date: typeof proposal.date === "string" ? proposal.date.trim() : original.date,
    location: typeof proposal.location === "string" ? proposal.location.trim() : original.location,
    startTime: typeof proposal.startTime === "string" ? proposal.startTime.trim() : original.startTime,
    items,
  };
}

export function describeAgendaErrors(agenda: AgendaData, errors: Record<string, string>) {
  const labels = new Map<string, string>([
    ["startTime", "Start time"],
    ["activeItem", "Highlighted item"],
    ["items", "Items"],
  ]);
  agenda.items.forEach((item, index) => {
    labels.set(item.id, `Item ${index + 1} "${item.title.replace(/\n/g, " ")}"`);
  });
  return describeErrors(labels, errors);
}
