import { createUniqueId } from "@/lib/id";
import type { AgendaData, AgendaItem, AgendaVariant } from "@/types/agenda";

export const MAX_AGENDA_ITEMS = 6;
export const AGENDA_VARIANTS: readonly {
  id: AgendaVariant;
  layoutId: string;
  name: string;
  description: string;
}[] = [
  { id: "schedule", layoutId: "wknd-agenda", name: "Schedule", description: "Sessions & times" },
  { id: "chapters", layoutId: "wknd-agenda-chapters", name: "Chapters", description: "Numbered contents" },
  { id: "cards", layoutId: "wknd-agenda-overview", name: "Cards", description: "Topics & descriptions" },
  { id: "spotlight", layoutId: "wknd-agenda-spotlight", name: "Spotlight", description: "Highlight the current topic" },
];

export function getAgendaVariantForLayout(layoutId: string) {
  return AGENDA_VARIANTS.find((variant) => variant.layoutId === layoutId)?.id;
}

export function createAgendaItem(id = createUniqueId("element")): AgendaItem {
  return {
    id,
    title: "",
    description: "",
    page: "",
    durationMinutes: 30,
    kind: "session",
    highlighted: false,
  };
}

export function createDefaultAgenda(
  variant: AgendaVariant,
  id = createUniqueId("component"),
): AgendaData {
  const topics = [
    ["Introduction", "Who we are and how we work"],
    ["Our Team", "The people behind the project"],
    ["The Brief", "Goals, challenges and context"],
    ["Our Approach", "Strategy and creative direction"],
    ["Timeline", "A 13-week road to launch"],
    ["Next Steps", "Investment and how we kick off"],
  ];
  const sessions = [
    { title: "Welcome\n& intros", minutes: 20 },
    { title: "The brief", minutes: 30 },
    { title: "Our approach", minutes: 45 },
    { title: "Break", minutes: 15 },
    { title: "Timeline", minutes: 30 },
    { title: "Next steps & Q&A", minutes: 40 },
  ];

  return {
    version: 1,
    id,
    variant,
    graphicsOnly: true,
    label: variant === "schedule" ? "Kick-off Workshop" : "Agenda",
    title: variant === "spotlight" ? "" : variant === "schedule" ? "Today's\nagenda." : variant === "chapters" ? "What's\ninside." : "On the\nagenda.",
    introMode: "auto",
    intro: "",
    date: "2026-11-09",
    location: "Weekend HQ",
    startTime: "09:00",
    items: topics.map<AgendaItem>(([title, description], index) => ({
      ...createAgendaItem(`${id}-item-${index + 1}`),
      title: variant === "schedule" ? sessions[index].title : title,
      description: variant === "schedule" ? "" : description,
      durationMinutes: variant === "schedule" ? sessions[index].minutes : 30,
      kind: variant === "schedule" && index === 3 ? "break" : "session",
      highlighted: index === (variant === "spotlight" ? 1 : 2),
    })),
  };
}

export function cloneAgenda(data: AgendaData, freshIds = false): AgendaData {
  return {
    ...data,
    id: freshIds ? createUniqueId("component") : data.id,
    items: data.items.map((item) => ({
      ...item,
      id: freshIds ? createUniqueId("element") : item.id,
    })),
  };
}

export function getAgendaActiveItemId(data: AgendaData) {
  return (data.items.find((item) => item.highlighted) ?? data.items[0])?.id;
}

export function getAgendaIntro(data: AgendaData) {
  if (data.introMode === "custom") return data.intro.trim();
  const count = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"][data.items.length] ?? String(data.items.length);
  return data.variant === "chapters"
    ? `${count} ${data.items.length === 1 ? "chapter" : "chapters"}, one story — from who we are to\nhow we kick off together.`
    : `${count} ${data.items.length === 1 ? "topic" : "topics"} we'll walk through together today.`;
}

export function parseAgendaTime(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatAgendaTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function getAgendaDuration(data: AgendaData) {
  return data.items.reduce((total, item) => total + item.durationMinutes, 0);
}

export function formatAgendaDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "";
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(date);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date);
  return `${weekday}, ${date.getUTCDate()} ${month}`;
}

// Checks persisted data without rejecting an older, ordinary slide.
export function isAgendaData(value: unknown): value is AgendaData {
  if (typeof value !== "object" || value === null) return false;
  const data = value as Record<string, unknown>;
  if (
    data.version !== 1 || typeof data.id !== "string" || !data.id ||
    !AGENDA_VARIANTS.some((variant) => variant.id === data.variant) ||
    (data.graphicsOnly !== undefined && data.graphicsOnly !== true) ||
    !["label", "title", "intro", "date", "location", "startTime"].every((key) => typeof data[key] === "string") ||
    (data.introMode !== "auto" && data.introMode !== "custom") ||
    !Array.isArray(data.items) || data.items.length < 1 || data.items.length > MAX_AGENDA_ITEMS
  ) return false;
  const ids = new Set<string>();
  return data.items.every((value: unknown) => {
    if (typeof value !== "object" || value === null) return false;
    const item = value as Record<string, unknown>;
    if (
      typeof item.id !== "string" || !item.id || ids.has(item.id) ||
      !["title", "description", "page"].every((key) => typeof item[key] === "string") ||
      typeof item.durationMinutes !== "number" || !Number.isFinite(item.durationMinutes) ||
      (item.kind !== "session" && item.kind !== "break") || typeof item.highlighted !== "boolean"
    ) return false;
    ids.add(item.id);
    return true;
  });
}
