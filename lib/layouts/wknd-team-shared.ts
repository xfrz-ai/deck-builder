import { createLayoutHeader } from "@/lib/layouts/layout-elements";

export interface TeamMember {
  photo: number;
  role: string;
}

export interface TeamSquad {
  description: string;
  key: string;
  members: readonly TeamMember[];
  name: string;
}

export const TEAM_SQUADS = {
  design: {
    key: "design",
    name: "Design",
    description: "Product & brand design",
    members: [
      { photo: 3, role: "Lead Product Designer" },
      { photo: 4, role: "UI/UX Designer" },
    ],
  },
  frontend: {
    key: "frontend",
    name: "Frontend",
    description: "Web & mobile interfaces",
    members: [
      { photo: 6, role: "Frontend Lead" },
      { photo: 1, role: "Frontend Engineer" },
      { photo: 2, role: "Frontend Engineer" },
    ],
  },
  backend: {
    key: "backend",
    name: "Backend",
    description: "APIs, data & infrastructure",
    members: [
      { photo: 0, role: "Backend Lead" },
      { photo: 7, role: "Backend Engineer" },
    ],
  },
  qa: {
    key: "qa",
    name: "QA",
    description: "Testing & release quality",
    members: [
      { photo: 5, role: "QA Lead" },
      { photo: 8, role: "QA Engineer" },
    ],
  },
} as const satisfies Record<string, TeamSquad>;

export function formatPeopleCount(count: number) {
  return `${String(count).padStart(2, "0")} people`;
}

export function createTeamHeader(
  options: Omit<Parameters<typeof createLayoutHeader>[0], "eyebrow">,
) {
  return createLayoutHeader({ ...options, eyebrow: "Our Team" });
}
