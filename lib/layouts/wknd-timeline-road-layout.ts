import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import { createDynamicTimelineSlide } from "@/lib/timeline/timeline-component-elements";
import { createDefaultTimeline } from "@/lib/timeline/timeline-model";

const ID = "wknd-timeline-road";

export const WKND_TIMELINE_ROAD_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Road to Launch",
  category: "timeline",
  slide: createDynamicTimelineSlide(createDefaultTimeline("road", ID), `layout-${ID}`),
};
