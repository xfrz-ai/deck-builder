import {
  PRESENTATION_ASPECT_RATIO,
  PRESENTATION_HEIGHT,
  PRESENTATION_WIDTH,
  type Presentation,
  type SlideElement,
  type Slide,
} from "@/types/presentation";
import { isSolidHexColor } from "@/lib/slides/slide-utils";
import { isAgendaData } from "@/lib/agenda/agenda-model";
import { isTeamData } from "@/lib/team/team-model";
import { isTimelineData } from "@/lib/timeline/timeline-model";
import { isTableCellRef, isTableData } from "@/lib/table/table-model";
import { isTextBlockData } from "@/lib/text/text-block";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isTimelineCollection(value: unknown) {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  let fullSlides = 0;
  return value.every((timeline: unknown) => {
    if (!isTimelineData(timeline) || ids.has(timeline.id)) return false;
    ids.add(timeline.id);
    if (timeline.placement === "slide") fullSlides++;
    return fullSlides <= 1;
  });
}

function isTextBlockCollection(value: unknown) {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((block: unknown) => {
    if (!isTextBlockData(block) || ids.has(block.id)) return false;
    ids.add(block.id); return true;
  });
}

function isComponentPart(value: unknown) {
  return (
    isRecord(value) &&
    value.kind === "card" &&
    typeof value.instanceId === "string" &&
    typeof value.groupId === "string" &&
    (value.part === "background" ||
      value.part === "image" ||
      value.part === "icon" ||
      value.part === "title" ||
      value.part === "description")
  );
}

function hasValidBaseElement(value: Record<string, unknown>) {
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    isFiniteNumber(value.rotation) &&
    isFiniteNumber(value.opacity) &&
    (value.locked === undefined || typeof value.locked === "boolean") &&
    (value.visible === undefined || typeof value.visible === "boolean") &&
    (value.role === undefined || value.role === "background") &&
    (value.agendaId === undefined || (typeof value.agendaId === "string" && value.agendaId.length > 0)) &&
    (value.teamId === undefined || (typeof value.teamId === "string" && value.teamId.length > 0)) &&
    (value.timelineId === undefined || (typeof value.timelineId === "string" && value.timelineId.length > 0)) &&
    (value.tableId === undefined || (typeof value.tableId === "string" && value.tableId.length > 0)) &&
    (value.tableCell === undefined || (typeof value.tableId === "string" && isTableCellRef(value.tableCell))) &&
    ((value.textBlockId === undefined && value.textBlockPart === undefined) ||
      (value.type === "text" && typeof value.textBlockId === "string" && value.textBlockId.length > 0 && (value.textBlockPart === "title" || value.textBlockPart === "body"))) &&
    (value.component === undefined || isComponentPart(value.component))
  );
}

function isSlideElement(value: unknown): value is SlideElement {
  if (!isRecord(value) || !hasValidBaseElement(value)) {
    return false;
  }

  switch (value.type) {
    case "shape":
      return (
        (value.shapeType === "rectangle" ||
          value.shapeType === "roundedRectangle" ||
          value.shapeType === "circle") &&
        typeof value.fill === "string" &&
        typeof value.stroke === "string" &&
        isFiniteNumber(value.strokeWidth) &&
        (value.cornerRadius === undefined ||
          isFiniteNumber(value.cornerRadius)) &&
        (value.dashed === undefined || typeof value.dashed === "boolean")
      );
    case "text":
      return (
        typeof value.text === "string" &&
        typeof value.fontFamily === "string" &&
        isFiniteNumber(value.fontSize) &&
        isFiniteNumber(value.fontWeight) &&
        typeof value.italic === "boolean" &&
        typeof value.color === "string" &&
        (value.align === "left" ||
          value.align === "center" ||
          value.align === "right" ||
          value.align === "justify") &&
        (value.verticalAlign === "top" ||
          value.verticalAlign === "middle" ||
          value.verticalAlign === "bottom") &&
        isFiniteNumber(value.lineHeight) &&
        isFiniteNumber(value.letterSpacing) &&
        (value.textDecoration === undefined ||
          value.textDecoration === "none" ||
          value.textDecoration === "underline") &&
        (value.padding === undefined || isFiniteNumber(value.padding))
      );
    case "image":
      return (
        typeof value.src === "string" &&
        value.src.length > 0 &&
        (value.originalWidth === undefined ||
          isFiniteNumber(value.originalWidth)) &&
        (value.originalHeight === undefined ||
          isFiniteNumber(value.originalHeight)) &&
        isFiniteNumber(value.cornerRadius) &&
        (value.fit === undefined ||
          value.fit === "cover" ||
          value.fit === "contain") &&
        (value.mockup === undefined ||
          (isRecord(value.mockup) && typeof value.mockup.deviceId === "string"))
      );
    default:
      return false;
  }
}

function isSlide(value: unknown): value is Slide {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.background === "string" &&
    isSolidHexColor(value.background) &&
    (value.backgroundThemeId === undefined ||
      typeof value.backgroundThemeId === "string") &&
    (value.darkMode === undefined || typeof value.darkMode === "boolean") &&
    (value.agenda === undefined || isAgendaData(value.agenda)) &&
    (value.team === undefined || isTeamData(value.team)) &&
    (value.timelines === undefined || isTimelineCollection(value.timelines)) &&
    (value.table === undefined || isTableData(value.table)) &&
    (value.textBlocks === undefined || isTextBlockCollection(value.textBlocks)) &&
    Array.isArray(value.elements) &&
    value.elements.every(isSlideElement)
  );
}

export function isPresentation(value: unknown): value is Presentation {
  if (!isRecord(value) || !Array.isArray(value.slides)) {
    return false;
  }

  const slideIds = new Set<string>();
  const elementIds = new Set<string>();

  return (
    value.schemaVersion === 1 &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.title === "string" &&
    value.aspectRatio === PRESENTATION_ASPECT_RATIO &&
    value.width === PRESENTATION_WIDTH &&
    value.height === PRESENTATION_HEIGHT &&
    value.slides.length > 0 &&
    value.slides.every((slide) => {
      if (!isSlide(slide) || slideIds.has(slide.id)) {
        return false;
      }

      if (
        slide.elements.some((element) => {
          if (elementIds.has(element.id)) {
            return true;
          }

          elementIds.add(element.id);
          return false;
        })
      ) {
        return false;
      }

      slideIds.add(slide.id);
      return true;
    })
  );
}
