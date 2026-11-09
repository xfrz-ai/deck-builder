import {
  instantiateSlideLayout,
  type SlideLayoutDefinition,
} from "@/lib/layouts/layout-definition";
import { WKND_AGENDA_CHAPTERS_LAYOUT } from "@/lib/layouts/wknd-agenda-chapters-layout";
import { WKND_AGENDA_LAYOUT } from "@/lib/layouts/wknd-agenda-layout";
import { WKND_AGENDA_OVERVIEW_LAYOUT } from "@/lib/layouts/wknd-agenda-overview-layout";
import { WKND_AGENDA_SPOTLIGHT_LAYOUT } from "@/lib/layouts/wknd-agenda-spotlight-layout";
import { WKND_BENTO_COLUMNS_LAYOUT } from "@/lib/layouts/wknd-bento-columns-layout";
import { WKND_BENTO_GRID_LAYOUT } from "@/lib/layouts/wknd-bento-grid-layout";
import { WKND_COVER_ARCHES_LAYOUT } from "@/lib/layouts/wknd-cover-arches-layout";
import { WKND_COVER_BRAND_LAYOUT } from "@/lib/layouts/wknd-cover-brand-layout";
import { WKND_COVER_D_LAYOUT } from "@/lib/layouts/wknd-cover-d-layout";
import { WKND_COVER_STAR_LAYOUT } from "@/lib/layouts/wknd-cover-star-layout";
import { WKND_FULL_TEXT_LAYOUT } from "@/lib/layouts/wknd-full-text-layout";
import { WKND_FULL_TEXT_PARAGRAPHS_LAYOUT } from "@/lib/layouts/wknd-full-text-paragraphs-layout";
import { WKND_FULL_TEXT_STATEMENT_LAYOUT } from "@/lib/layouts/wknd-full-text-statement-layout";
import { WKND_IMAGE_APPROACH_LAYOUT } from "@/lib/layouts/wknd-image-approach-layout";
import { WKND_IMAGE_CHAPTER_LAYOUT } from "@/lib/layouts/wknd-image-chapter-layout";
import { WKND_IMAGE_FIELD_NOTES_LAYOUT } from "@/lib/layouts/wknd-image-field-notes-layout";
import { WKND_IMAGE_MATERIALS_LAYOUT } from "@/lib/layouts/wknd-image-materials-layout";
import { WKND_IMAGE_MOODS_LAYOUT } from "@/lib/layouts/wknd-image-moods-layout";
import { WKND_IMAGE_SPLIT_LAYOUT } from "@/lib/layouts/wknd-image-split-layout";
import { WKND_IMAGE_TWO_STUDIES_LAYOUT } from "@/lib/layouts/wknd-image-two-studies-layout";
import { WKND_MOCKUP_LAPTOP_CALLOUTS_LAYOUT } from "@/lib/layouts/wknd-mockup-laptop-callouts-layout";
import { WKND_MOCKUP_LAPTOP_WEBSITE_LAYOUT } from "@/lib/layouts/wknd-mockup-laptop-website-layout";
import { WKND_MOCKUP_LAPTOP_LAYOUT } from "@/lib/layouts/wknd-mockup-laptop-layout";
import { WKND_MOCKUP_PHONE_REGRESSION_LAYOUT } from "@/lib/layouts/wknd-mockup-phone-regression-layout";
import { WKND_MOCKUP_PHONE_SHIPPED_LAYOUT } from "@/lib/layouts/wknd-mockup-phone-shipped-layout";
import { WKND_MOCKUP_PHONE_QA_LAYOUT } from "@/lib/layouts/wknd-mockup-phone-qa-layout";
import { WKND_MOCKUP_PHONE_LAYOUT } from "@/lib/layouts/wknd-mockup-phone-layout";
import { WKND_THANK_YOU_LAYOUT } from "@/lib/layouts/wknd-thank-you-layout";
import { WKND_QUESTIONS_LAYOUT } from "@/lib/layouts/wknd-questions-layout";
import { WKND_TEAM_ORG_LAYOUT } from "@/lib/layouts/wknd-team-org-layout";
import { WKND_TEAM_SQUADS_LAYOUT } from "@/lib/layouts/wknd-team-squads-layout";
import { WKND_SOW_MODULES_LAYOUT } from "@/lib/layouts/wknd-sow-modules-layout";
import { WKND_TABLE_BUG_TRIAGE_LAYOUT } from "@/lib/layouts/wknd-table-bug-triage-layout";
import { WKND_TABLE_PACKAGES_LAYOUT } from "@/lib/layouts/wknd-table-packages-layout";
import { WKND_TABLE_SCOPE_LAYOUT } from "@/lib/layouts/wknd-table-scope-layout";
import { WKND_TEAM_STRUCTURE_LAYOUT } from "@/lib/layouts/wknd-team-structure-layout";
import { WKND_TEAM_TREE_LAYOUT } from "@/lib/layouts/wknd-team-tree-layout";
import { WKND_TIMELINE_ROAD_LAYOUT } from "@/lib/layouts/wknd-timeline-road-layout";
import { WKND_TIMELINE_ROADMAP_LAYOUT } from "@/lib/layouts/wknd-timeline-roadmap-layout";
import { WKND_TIMELINE_STEPS_LAYOUT } from "@/lib/layouts/wknd-timeline-steps-layout";

export const SLIDE_LAYOUTS: readonly SlideLayoutDefinition[] = [
  WKND_COVER_BRAND_LAYOUT,
  WKND_COVER_STAR_LAYOUT,
  WKND_COVER_ARCHES_LAYOUT,
  WKND_COVER_D_LAYOUT,
  WKND_AGENDA_LAYOUT,
  WKND_AGENDA_CHAPTERS_LAYOUT,
  WKND_AGENDA_OVERVIEW_LAYOUT,
  WKND_AGENDA_SPOTLIGHT_LAYOUT,
  WKND_TEAM_STRUCTURE_LAYOUT,
  WKND_TEAM_SQUADS_LAYOUT,
  WKND_TEAM_ORG_LAYOUT,
  WKND_TEAM_TREE_LAYOUT,
  WKND_TIMELINE_ROAD_LAYOUT,
  WKND_TIMELINE_STEPS_LAYOUT,
  WKND_TIMELINE_ROADMAP_LAYOUT,
  WKND_SOW_MODULES_LAYOUT,
  WKND_TABLE_PACKAGES_LAYOUT,
  WKND_TABLE_SCOPE_LAYOUT,
  WKND_TABLE_BUG_TRIAGE_LAYOUT,
  WKND_IMAGE_MOODS_LAYOUT,
  WKND_IMAGE_MATERIALS_LAYOUT,
  WKND_IMAGE_CHAPTER_LAYOUT,
  WKND_IMAGE_FIELD_NOTES_LAYOUT,
  WKND_IMAGE_TWO_STUDIES_LAYOUT,
  WKND_IMAGE_APPROACH_LAYOUT,
  WKND_IMAGE_SPLIT_LAYOUT,
  WKND_BENTO_COLUMNS_LAYOUT,
  WKND_BENTO_GRID_LAYOUT,
  WKND_FULL_TEXT_LAYOUT,
  WKND_FULL_TEXT_PARAGRAPHS_LAYOUT,
  WKND_FULL_TEXT_STATEMENT_LAYOUT,
  WKND_MOCKUP_LAPTOP_LAYOUT,
  WKND_MOCKUP_LAPTOP_CALLOUTS_LAYOUT,
  WKND_MOCKUP_LAPTOP_WEBSITE_LAYOUT,
  WKND_MOCKUP_PHONE_LAYOUT,
  WKND_MOCKUP_PHONE_QA_LAYOUT,
  WKND_MOCKUP_PHONE_REGRESSION_LAYOUT,
  WKND_MOCKUP_PHONE_SHIPPED_LAYOUT,
  WKND_THANK_YOU_LAYOUT,
  WKND_QUESTIONS_LAYOUT,
];

export type SlideLayoutId = SlideLayoutDefinition["id"];

export function createSlideFromLayout(layoutId: SlideLayoutId) {
  const layout = SLIDE_LAYOUTS.find((item) => item.id === layoutId);

  return layout ? instantiateSlideLayout(layout) : null;
}
