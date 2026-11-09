import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import { createTeamSlide } from "@/lib/team/team-elements";
import { createDefaultTeam } from "@/lib/team/team-model";

const ID = "wknd-team-tree";

export const WKND_TEAM_TREE_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Team Org Tree",
  category: "team",
  slide: createTeamSlide(createDefaultTeam("tree", ID), `layout-${ID}`),
};
