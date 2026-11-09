import { gridX, gridY } from "@/lib/layouts/layout-grid";
import type { Presentation, Slide, SlideElement } from "@/types/presentation";
import type { TimelineData } from "@/types/timeline";

function belongsToGraphic(element: SlideElement, timeline: TimelineData) {
  if (element.role === "background") return false;
  if (timeline.placement === "component") return true;
  if (element.type === "image") {
    // Step decorations and the small roadmap star follow the phase layout.
    return timeline.variant === "steps" ||
      (timeline.variant === "roadmap" && element.width === 164 && element.height === 164);
  }
  if (timeline.variant === "roadmap") return element.y >= gridY(4);
  const introY = timeline.variant === "steps" ? gridY(4) : gridY(5) + 24;
  if (element.type === "text" && element.x === gridX(1) && element.y === introY) return false;
  // Geometry also identifies legacy parts after duplication changes their IDs.
  return element.y >= 300;
}

export function detachTimelineStaticElements(slide: Slide): Slide {
  const pending = slide.timelines?.filter((timeline) => !timeline.graphicsOnly ||
    slide.elements.some((element) => element.timelineId === timeline.id && element.role === "background"),
  );
  if (!pending?.length) return slide;
  const timelines = new Map(pending.map((timeline) => [timeline.id, timeline]));
  return {
    ...slide,
    timelines: slide.timelines?.map((timeline) => timelines.has(timeline.id) ? { ...timeline, graphicsOnly: true as const } : timeline),
    elements: slide.elements.map((element) => {
      const timeline = element.timelineId ? timelines.get(element.timelineId) : undefined;
      if (!timeline || belongsToGraphic(element, timeline)) return element;
      return { ...element, timelineId: undefined, locked: element.role === "background" || element.type === "image" };
    }),
  };
}

export function normalizeTimelinePresentation(presentation: Presentation): Presentation {
  let changed = false;
  const slides = presentation.slides.map((slide) => {
    const normalized = detachTimelineStaticElements(slide);
    changed ||= normalized !== slide;
    return normalized;
  });
  return changed ? { ...presentation, slides } : presentation;
}

function getTimelineGraphicElements(slide: Slide, timelineId: string) {
  const timeline = slide.timelines?.find((item) => item.id === timelineId);
  if (!timeline) return [];
  return slide.elements.filter((element) => element.timelineId === timelineId && element.visible !== false &&
    (timeline.graphicsOnly || belongsToGraphic(element, timeline)),
  );
}

export function getTimelineGraphicSelectionId(slide: Slide, timelineId: string) {
  const elements = getTimelineGraphicElements(slide, timelineId);
  return (elements.find((element) => element.type === "shape") ?? elements[0])?.id;
}

export function getTimelineGraphicBounds(slide: Slide, timelineId: string) {
  const elements = getTimelineGraphicElements(slide, timelineId);
  if (!elements.length) return null;
  const x = Math.min(...elements.map((element) => element.x));
  const y = Math.min(...elements.map((element) => element.y));
  return {
    x, y,
    width: Math.max(...elements.map((element) => element.x + element.width)) - x,
    height: Math.max(...elements.map((element) => element.y + element.height)) - y,
  };
}

// The road passes behind the static arrow, while milestones sit above it.
export function isTimelineRoadDot(element: SlideElement) {
  return element.type === "shape" && element.shapeType === "circle" && element.width === 5 && element.height === 5;
}
