export type TeamVariant = "structure" | "squads" | "people" | "list" | "org" | "tree";

export interface TeamPhoto {
  src: string;
  width: number;
  height: number;
}

export interface TeamPerson {
  id: string;
  name: string;
  role: string;
  photo: TeamPhoto | null;
}

// The person heading the whole team, such as the CEO, in the org variants.
export interface TeamLeader extends TeamPerson {
  badge: string;
}

export interface TeamGroup {
  id: string;
  name: string;
  description: string;
  members: TeamPerson[];
}

export interface TeamData {
  version: 1;
  id: string;
  variant: TeamVariant;
  graphicsOnly?: true;
  // Initial template copy; subsequent text edits live on the canvas.
  label: string;
  title: string;
  introMode: "auto" | "custom";
  intro: string;
  showPhotos: boolean;
  showRoles: boolean;
  leader?: TeamLeader;
  groups: TeamGroup[];
}

export interface TeamEditorSession {
  slideId: string;
  initialData: TeamData;
}
