import {
  instantiateSlideLayout,
  type SlideLayoutDefinition,
} from "@/lib/layouts/layout-definition";
import { WKND_AGENDA_CHAPTERS_LAYOUT } from "@/lib/layouts/wknd-agenda-chapters-layout";
import { WKND_AGENDA_LAYOUT } from "@/lib/layouts/wknd-agenda-layout";
import { WKND_AGENDA_OVERVIEW_LAYOUT } from "@/lib/layouts/wknd-agenda-overview-layout";
import { WKND_COVER_ARCHES_LAYOUT } from "@/lib/layouts/wknd-cover-arches-layout";
import { WKND_COVER_BRAND_LAYOUT } from "@/lib/layouts/wknd-cover-brand-layout";
import { WKND_COVER_D_LAYOUT } from "@/lib/layouts/wknd-cover-d-layout";
import { WKND_COVER_STAR_LAYOUT } from "@/lib/layouts/wknd-cover-star-layout";
import { WKND_FULL_TEXT_LAYOUT } from "@/lib/layouts/wknd-full-text-layout";
import { WKND_FULL_TEXT_PARAGRAPHS_LAYOUT } from "@/lib/layouts/wknd-full-text-paragraphs-layout";
import { WKND_FULL_TEXT_STATEMENT_LAYOUT } from "@/lib/layouts/wknd-full-text-statement-layout";
import { WKND_MOCKUP_LAPTOP_LAYOUT } from "@/lib/layouts/wknd-mockup-laptop-layout";
import { WKND_MOCKUP_PHONE_LAYOUT } from "@/lib/layouts/wknd-mockup-phone-layout";
import { WKND_TEAM_LIST_LAYOUT } from "@/lib/layouts/wknd-team-list-layout";
import { WKND_TEAM_PEOPLE_LAYOUT } from "@/lib/layouts/wknd-team-people-layout";
import { WKND_TEAM_SQUADS_LAYOUT } from "@/lib/layouts/wknd-team-squads-layout";
import { WKND_TABLE_PACKAGES_LAYOUT } from "@/lib/layouts/wknd-table-packages-layout";
import { WKND_TABLE_SCOPE_LAYOUT } from "@/lib/layouts/wknd-table-scope-layout";
import { WKND_TEAM_STRUCTURE_LAYOUT } from "@/lib/layouts/wknd-team-structure-layout";
import { WKND_TIMELINE_ROAD_LAYOUT } from "@/lib/layouts/wknd-timeline-road-layout";
import { WKND_TIMELINE_ROADMAP_LAYOUT } from "@/lib/layouts/wknd-timeline-roadmap-layout";
import { WKND_TIMELINE_STEPS_LAYOUT } from "@/lib/layouts/wknd-timeline-steps-layout";

export const SLIDE_LAYOUTS: readonly SlideLayoutDefinition[] = [
  WKND_COVER_STAR_LAYOUT,
  WKND_COVER_ARCHES_LAYOUT,
  WKND_COVER_BRAND_LAYOUT,
  WKND_COVER_D_LAYOUT,
  WKND_AGENDA_LAYOUT,
  WKND_AGENDA_CHAPTERS_LAYOUT,
  WKND_AGENDA_OVERVIEW_LAYOUT,
  WKND_TEAM_STRUCTURE_LAYOUT,
  WKND_TEAM_SQUADS_LAYOUT,
  WKND_TEAM_PEOPLE_LAYOUT,
  WKND_TEAM_LIST_LAYOUT,
  WKND_TIMELINE_ROAD_LAYOUT,
  WKND_TIMELINE_STEPS_LAYOUT,
  WKND_TIMELINE_ROADMAP_LAYOUT,
  WKND_TABLE_PACKAGES_LAYOUT,
  WKND_TABLE_SCOPE_LAYOUT,
  WKND_FULL_TEXT_LAYOUT,
  WKND_FULL_TEXT_PARAGRAPHS_LAYOUT,
  WKND_FULL_TEXT_STATEMENT_LAYOUT,
  WKND_MOCKUP_LAPTOP_LAYOUT,
  WKND_MOCKUP_PHONE_LAYOUT,
];

export type SlideLayoutId = SlideLayoutDefinition["id"];

export function createSlideFromLayout(layoutId: SlideLayoutId) {
  const layout = SLIDE_LAYOUTS.find((item) => item.id === layoutId);

  return layout ? instantiateSlideLayout(layout) : null;
}
