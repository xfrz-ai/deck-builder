import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import { createTeamSlide } from "@/lib/team/team-elements";
import { createDefaultTeam } from "@/lib/team/team-model";

const ID = "wknd-team-org";

export const WKND_TEAM_ORG_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Team Org Cards",
  category: "team",
  slide: createTeamSlide(createDefaultTeam("org", ID), `layout-${ID}`),
};
