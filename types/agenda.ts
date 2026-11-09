export type AgendaVariant = "schedule" | "chapters" | "cards" | "spotlight";

export interface AgendaItem {
  id: string;
  title: string;
  description: string;
  page: string;
  durationMinutes: number;
  kind: "session" | "break";
  highlighted: boolean;
}

// Content survives design changes, including fields hidden by a variant.
export interface AgendaData {
  version: 1;
  id: string;
  variant: AgendaVariant;
  graphicsOnly?: true;
  // Initial slide copy, retained for existing decks. The form edits the
  // graphic's items and schedule; standalone slide text lives on the canvas.
  label: string;
  title: string;
  introMode: "auto" | "custom";
  intro: string;
  date: string;
  location: string;
  startTime: string;
  items: AgendaItem[];
}

export interface AgendaEditorSession {
  slideId: string;
  initialData: AgendaData;
}
