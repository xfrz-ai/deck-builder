export type TimelineVariant = "road" | "steps" | "roadmap" | "bars";

export interface TimelinePhase {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
}

export interface TimelineData {
  version: 1;
  id: string;
  variant: TimelineVariant;
  placement: "slide" | "component";
  graphicsOnly?: true;
  // Initial template text; subsequent edits happen directly on the canvas.
  label: string;
  title: string;
  introMode: "auto" | "custom";
  autoTitle?: boolean;
  intro: string;
  periodFormat: "weeks" | "dates" | "months";
  position: { x: number; y: number };
  phases: TimelinePhase[];
}

export interface TimelineEditorSession {
  slideId: string;
  timelineId: string | null;
  initialData: TimelineData;
}
