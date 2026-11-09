import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import { createDynamicTimelineSlide } from "@/lib/timeline/timeline-component-elements";
import { createDefaultTimeline } from "@/lib/timeline/timeline-model";

const ID = "wknd-timeline-roadmap";

export const WKND_TIMELINE_ROADMAP_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Roadmap",
  category: "timeline",
  slide: createDynamicTimelineSlide(createDefaultTimeline("roadmap", ID), `layout-${ID}`),
};
