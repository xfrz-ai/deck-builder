import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import { createTeamSlide } from "@/lib/team/team-elements";
import { createDefaultTeam } from "@/lib/team/team-model";

const ID = "wknd-team-squads";

export const WKND_TEAM_SQUADS_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Team Squads",
  category: "team",
  slide: createTeamSlide(createDefaultTeam("squads", ID), `layout-${ID}`),
};
