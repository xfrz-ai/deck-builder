import { gridX, gridY } from "@/lib/layouts/layout-grid";
import type { Presentation, Slide, SlideElement } from "@/types/presentation";
import type { TeamData } from "@/types/team";

function belongsToGraphic(element: SlideElement, team: TeamData) {
  if (element.role === "background") return false;
  if (element.type === "image" && !team.groups.some((group) =>
    group.members.some((member) => member.photo?.src === element.src),
  )) return false;
  // Earlier versions owned the whole template. The fixed regions also
  // identify its generated content after slide duplication changes IDs.
  if (team.variant === "structure") {
    return (element.y >= gridY(5) && element.y < 1000) ||
      (element.x >= gridX(19) && element.y >= gridY(1) && element.y < gridY(4));
  }
  if (team.variant === "list") return element.y >= gridY(4) && element.y < 1000;
  if (team.variant === "org" || team.variant === "tree") {
    return (element.y >= gridY(4) && element.y < 1000) || element.x >= gridX(10);
  }
  return element.x >= gridX(9) && element.y >= gridY(1) && element.y < 1000;
}

export function detachTeamStaticElements(slide: Slide): Slide {
  const team = slide.team;
  if (!team) return slide;
  const ownsFrame = slide.elements.some((element) => element.teamId === team.id && element.role === "background");
  if (team.graphicsOnly && !ownsFrame) return slide;
  return {
    ...slide,
    team: { ...team, graphicsOnly: true },
    elements: slide.elements.map((element) => {
      if (element.teamId !== team.id || belongsToGraphic(element, team)) return element;
      return {
        ...element,
        teamId: undefined,
        // Decorations can overlap the diagram. Keep their image hit areas
        // disabled so clicking the graphic selects the team component.
        locked: element.role === "background" || element.type === "image",
      };
    }),
  };
}

export function normalizeTeamPresentation(presentation: Presentation): Presentation {
  let changed = false;
  const slides = presentation.slides.map((slide) => {
    const normalized = detachTeamStaticElements(slide);
    changed ||= normalized !== slide;
    return normalized;
  });
  return changed ? { ...presentation, slides } : presentation;
}

function getTeamGraphicElements(slide: Slide) {
  const team = slide.team;
  if (!team) return [];
  return slide.elements.filter((element) =>
    element.teamId === team.id && element.visible !== false &&
    (team.graphicsOnly || belongsToGraphic(element, team)),
  );
}

export function getTeamGraphicSelectionId(slide: Slide) {
  const elements = getTeamGraphicElements(slide);
  return (elements.find((element) => element.type === "shape") ?? elements[0])?.id;
}

export function getTeamGraphicBounds(slide: Slide) {
  const elements = getTeamGraphicElements(slide);
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

// Structure connectors stay behind the decorative star, while the team
// cards and counters remain above it. This works with duplicated IDs too.
export function isTeamConnectorElement(element: SlideElement) {
  return element.type === "shape" &&
    element.y >= gridY(5) && element.y <= gridY(7) &&
    (element.width <= 14 || element.height <= 14);
}
