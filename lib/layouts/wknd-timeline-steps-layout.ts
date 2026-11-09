import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import { createDynamicTimelineSlide } from "@/lib/timeline/timeline-component-elements";
import { createDefaultTimeline } from "@/lib/timeline/timeline-model";

const ID = "wknd-timeline-steps";

export const WKND_TIMELINE_STEPS_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Step by Step",
  category: "timeline",
  slide: createDynamicTimelineSlide(createDefaultTimeline("steps", ID), `layout-${ID}`),
};
