import { gridX, gridY } from "@/lib/layouts/layout-grid";
import type { AgendaData } from "@/types/agenda";
import type { Presentation, Slide, SlideElement } from "@/types/presentation";

function belongsToGraphic(element: SlideElement, agenda: AgendaData) {
  if (element.role === "background" || element.type === "image") return false;
  // Earlier Agenda versions locked the complete template. Its generated
  // content has fixed bounds, including on slides duplicated with fresh IDs.
  if (agenda.variant === "schedule") return element.y >= 584 && element.y < 1000;
  if (agenda.variant === "cards") return element.y >= gridY(8) && element.y < 1000;
  if (agenda.variant === "spotlight") return element.x < gridX(13) && element.y >= 288 && element.y < 1000;
  return element.x >= gridX(13) && element.y >= 190 && element.y < 1000;
}

export function detachAgendaStaticElements(slide: Slide): Slide {
  const agenda = slide.agenda;
  if (!agenda || agenda.graphicsOnly) return slide;
  return {
    ...slide,
    agenda: { ...agenda, graphicsOnly: true },
    elements: slide.elements.map((element) => {
      if (element.agendaId !== agenda.id || belongsToGraphic(element, agenda)) return element;
      return { ...element, agendaId: undefined, locked: element.role === "background" };
    }),
  };
}

function getAgendaGraphicElements(slide: Slide) {
  const agenda = slide.agenda;
  if (!agenda) return [];
  return slide.elements.filter((element) =>
    element.agendaId === agenda.id && element.visible !== false &&
    (agenda.graphicsOnly || belongsToGraphic(element, agenda)),
  );
}

// One owned element represents selection of the complete graphic. The
// graphic stays locked; its content is edited through the Agenda form.
export function getAgendaGraphicSelectionId(slide: Slide) {
  const elements = getAgendaGraphicElements(slide);
  return (elements.find((element) => element.type === "shape") ?? elements[0])?.id;
}

export function getAgendaGraphicBounds(slide: Slide) {
  const elements = getAgendaGraphicElements(slide);
  if (!elements.length) return null;
  const x = Math.min(...elements.map((element) => element.x));
  const y = Math.min(...elements.map((element) => element.y));
  return {
    x,
    y,
    width: Math.max(...elements.map((element) => element.x + element.width)) - x,
    height: Math.max(...elements.map((element) => element.y + element.height)) - y,
  };
}

export function normalizeAgendaPresentation(presentation: Presentation): Presentation {
  let changed = false;
  const slides = presentation.slides.map((slide) => {
    const normalized = detachAgendaStaticElements(slide);
    changed ||= normalized !== slide;
    return normalized;
  });
  return changed ? { ...presentation, slides } : presentation;
}
