import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import { createTeamSlide } from "@/lib/team/team-elements";
import { createDefaultTeam } from "@/lib/team/team-model";

const ID = "wknd-team-structure";

export const WKND_TEAM_STRUCTURE_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Team Structure",
  category: "team",
  slide: createTeamSlide(createDefaultTeam("structure", ID), `layout-${ID}`),
};
