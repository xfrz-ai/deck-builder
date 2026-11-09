import { createFrameElements } from "@/lib/backgrounds/background-themes";
import { createLayoutObject, createLayoutPill, createLayoutShape, WKND_COLORS } from "@/lib/layouts/layout-elements";
import { gridWidth, gridX, gridY, LAYOUT_GRID } from "@/lib/layouts/layout-grid";
import { createLayoutText, type LayoutTextOptions } from "@/lib/layouts/layout-text";
import { applyDarkModeToElement } from "@/lib/slides/dark-mode";
import { componentTextFits, estimateComponentText, type MeasureComponentText } from "@/lib/text/component-text";
import { createTimelineModelFromPhases, getTimelinePhaseError, parseDateInput } from "@/lib/timeline/timeline-dates";
import { createTimelineElements } from "@/lib/timeline/timeline-elements";
import { getTimelineIntro, getTimelinePeriod, getTimelinePhaseLimit, getTimelineRange, getTimelineTitle } from "@/lib/timeline/timeline-model";
import { detachTimelineStaticElements, isTimelineRoadDot } from "@/lib/timeline/timeline-ownership";
import { sampleTimelineRoad } from "@/lib/timeline/timeline-road-path";
import type { Slide, SlideElement, TextElement } from "@/types/presentation";
import type { TimelineData, TimelinePhase } from "@/types/timeline";

export type MeasureTimelineText = MeasureComponentText;
export const estimateTimelineText = estimateComponentText;
const CONTENT_WIDTH = gridWidth(24);
const CONTENT_RIGHT = gridX(1) + CONTENT_WIDTH;
const MS_PER_DAY = 86_400_000;

function fittedText(
  options: LayoutTextOptions & { letterSpacing?: number },
  measure: MeasureTimelineText,
  minSize = options.fontSize,
  maxLines = 1,
): TextElement {
  const { letterSpacing = 0, ...textOptions } = options;
  const element = { ...createLayoutText(textOptions), letterSpacing };
  while (element.fontSize > minSize && !componentTextFits(element, measure, maxLines)) element.fontSize--;
  return element;
}

function phaseTitle(phase: TimelinePhase) {
  return phase.title.trim().replace(/\s*\n\s*/g, " ");
}

function header(data: TimelineData, measure: MeasureTimelineText): SlideElement[] {
  const roadmap = data.variant === "roadmap";
  const steps = data.variant === "steps";
  const size = 112;
  const title = steps || roadmap ? getTimelineTitle(data).replace(/\s*\n\s*/g, " ") : getTimelineTitle(data);
  const intro = getTimelineIntro(data);
  return [
    ...(!roadmap && data.label.trim() ? createLayoutPill({
      id: `${data.id}-label`, text: data.label.trim(), x: gridX(1), y: gridY(1),
      width: Math.min(gridWidth(8), Math.ceil(measure(data.label.trim(), 24)) + 44),
      height: 48, fontSize: 24, color: WKND_COLORS.white,
    }) : []),
    fittedText({
      id: `${data.id}-title`, text: title, x: gridX(1), y: roadmap ? gridY(1) - 24 : gridY(2),
      width: gridWidth(roadmap ? 14 : steps ? 12 : 8), height: roadmap ? 104 : steps ? 104 : 207,
      fontSize: size, fontWeight: 600, lineHeight: 0.92,
      letterSpacing: roadmap ? -4.5 : -size * 0.04, color: WKND_COLORS.white,
    }, measure, 64, steps || roadmap ? 1 : 2),
    ...(intro ? [fittedText({
      id: `${data.id}-intro`, text: roadmap ? intro.replace(/\s*\n\s*/g, " ") : intro,
      x: gridX(1), y: roadmap ? gridY(3) - 24 : steps ? gridY(4) : gridY(5) + 24,
      width: gridWidth(roadmap ? 14 : 8), height: roadmap ? 36 : 72, fontSize: 28,
      lineHeight: roadmap ? 1.2 : 1.28, color: WKND_COLORS.white, opacity: roadmap ? 0.7 : 0.8,
    }, measure, 24, roadmap ? 1 : 2)] : []),
  ];
}

function roadElements(data: TimelineData, measure: MeasureTimelineText): SlideElement[] {
  const anchors = [
    { x: gridX(2) + 26, y: gridY(9) + 24 },
    { x: gridX(7) + 26, y: gridY(11) + 24 },
    { x: gridX(12) + 26, y: gridY(9) + 24 },
    { x: gridX(16) + 26, y: gridY(7) + 24 },
    { x: gridX(20) + 26, y: gridY(5) + 24 },
  ];
  const stops = data.phases.map((_, index) => {
    const position = data.phases.length === 1 ? 0 : index / (data.phases.length - 1) * 4;
    const lower = Math.floor(position);
    const upper = Math.min(4, lower + 1);
    const fraction = position - lower;
    return {
      x: anchors[lower].x + (anchors[upper].x - anchors[lower].x) * fraction,
      y: anchors[lower].y + (anchors[upper].y - anchors[lower].y) * fraction,
      above: position < 1.5,
    };
  });
  const dots = sampleTimelineRoad([{ x: -48, y: 624 }, ...stops, { x: 1716, y: 336 }], stops);
  const elements: SlideElement[] = dots.map((dot, index) => createLayoutShape({
    id: `${data.id}-road-dot-${index}`, shapeType: "circle", x: Math.round(dot.x - 2.5), y: Math.round(dot.y - 2.5),
    width: 5, height: 5, fill: WKND_COLORS.white,
  }));
  elements.push(createLayoutObject({ id: `${data.id}-object`, file: "3d-arrow.png", size: 920, x: 1120, y: -330 }));
  data.phases.forEach((phase, index) => {
    const id = `${data.id}-${phase.id}`;
    const center = stops[index];
    const x = center.x - 26;
    const top = center.above ? center.y - 28 - 16 - 128 : center.y + 28 + 16;
    const last = index === data.phases.length - 1;
    elements.push(
      createLayoutShape({ id: `${id}-node`, shapeType: "circle", x: center.x - 28, y: center.y - 28, width: 56, height: 56, fill: last ? WKND_COLORS.orange : WKND_COLORS.white }),
      createLayoutText({ id: `${id}-number`, text: String(index + 1).padStart(2, "0"), x: center.x - 28, y: center.y - 28, width: 56, height: 56, fontSize: 20, fontWeight: 600, align: "center", verticalAlign: "middle", color: last ? WKND_COLORS.white : WKND_COLORS.blue }),
      fittedText({ id: `${id}-period`, text: getTimelinePeriod(data, phase), x, y: top, width: gridWidth(4), height: 24, fontSize: 18, color: WKND_COLORS.white, opacity: 0.8 }, measure, 14),
      fittedText({ id: `${id}-title`, text: phaseTitle(phase), x, y: top + 30, width: gridWidth(4), height: 40, fontSize: 32, fontWeight: 600, letterSpacing: -0.5, color: WKND_COLORS.white }, measure, 24),
      fittedText({ id: `${id}-description`, text: phase.description.trim(), x, y: top + 80, width: gridWidth(4) - 24, height: 48, fontSize: 18, lineHeight: 1.3, color: WKND_COLORS.white, opacity: 0.8 }, measure, 16, 2),
    );
  });
  return elements;
}

function stepElements(data: TimelineData, measure: MeasureTimelineText): SlideElement[] {
  const count = Math.max(1, data.phases.length);
  const width = (CONTENT_WIDTH - 24 * (count - 1)) / count;
  const rise = count > 1 ? Math.min(100, 400 / (count - 1)) : 0;
  const x = (index: number) => gridX(1) + index * (width + 24);
  const top = (index: number) => gridY(12) - 200 - index * rise;
  const elements: SlideElement[] = data.phases.flatMap((phase, index) => {
    const id = `${data.id}-${phase.id}`;
    const contentX = x(index) + 28;
    const contentWidth = width - 56;
    const y = top(index);
    return [
      createLayoutShape({ id: `${id}-card`, shapeType: "roundedRectangle", x: x(index), y, width, height: gridY(12) - y, cornerRadius: 24, fill: index === count - 1 ? WKND_COLORS.yellow : WKND_COLORS.cream }),
      createLayoutText({ id: `${id}-number`, text: String(index + 1).padStart(2, "0"), x: contentX, y: y + 32, width: contentWidth, height: 24, fontSize: 20, color: WKND_COLORS.muted }),
      fittedText({ id: `${id}-title`, text: phaseTitle(phase), x: contentX, y: y + 68, width: contentWidth, height: 44, fontSize: 36, fontWeight: 600, letterSpacing: -0.5 }, measure, 24),
      fittedText({ id: `${id}-period`, text: getTimelinePeriod(data, phase), x: contentX, y: y + 120, width: contentWidth, height: 26, fontSize: 21, color: WKND_COLORS.muted }, measure, 16),
      ...(index > 0 && phase.description.trim() ? [fittedText({ id: `${id}-description`, text: phase.description.trim(), x: contentX, y: y + 158, width: contentWidth, height: 48, fontSize: 18, lineHeight: 1.3, color: WKND_COLORS.muted }, measure, 16, 2)] : []),
    ];
  });
  if (data.phases.length) {
    const arrowIndex = Math.max(0, count - 2);
    elements.push(
      createLayoutObject({ id: `${data.id}-object-arrow`, file: "3d-arrow.png", size: 160, x: x(arrowIndex) - 116, y: top(arrowIndex) - 128 }),
      createLayoutObject({ id: `${data.id}-object-stars`, file: "3d-stars.png", size: 264, x: x(count - 1) + (width - 264) / 2, y: top(count - 1) - 248 }),
    );
  }
  return elements;
}

function quarterDay(serial: number) {
  const date = new Date(0);
  date.setUTCFullYear(Math.floor(serial / 4), serial % 4 * 3, 1);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime() / MS_PER_DAY;
}

function quarterLabel(serial: number) {
  return `Q${serial % 4 + 1} ${Math.floor(serial / 4)}`;
}

function roadmapElements(data: TimelineData, measure: MeasureTimelineText): SlideElement[] {
  const range = getTimelineRange(data);
  const startDate = new Date(range.start * MS_PER_DAY);
  const endDate = new Date(range.end * MS_PER_DAY);
  const firstQuarter = startDate.getUTCFullYear() * 4 + Math.floor(startDate.getUTCMonth() / 3);
  const lastQuarter = endDate.getUTCFullYear() * 4 + Math.floor(endDate.getUTCMonth() / 3);
  const quarterCount = lastQuarter - firstQuarter + 1;
  const perColumn = Math.max(1, Math.ceil(quarterCount / 8));
  const columns = Math.ceil(quarterCount / perColumn);
  const axisStart = quarterDay(firstQuarter);
  const axisEnd = quarterDay(lastQuarter + 1);
  const dateX = (day: number) => gridX(1) + (day - axisStart) / (axisEnd - axisStart) * CONTENT_WIDTH;
  const chartTop = gridY(4);
  const barTop = chartTop + 48;
  const pitch = Math.min(104, (936 - barTop) / Math.max(1, data.phases.length));
  const barHeight = Math.min(88, pitch - 16);
  const elements: SlideElement[] = [
    createLayoutObject({ id: `${data.id}-object-n`, file: "3d-n-white.png", size: 280, x: 1550, y: 24 }),
  ];
  for (let index = 0; index <= columns; index++) {
    const serial = Math.min(firstQuarter + index * perColumn, lastQuarter + 1);
    const x = dateX(quarterDay(serial));
    elements.push(createLayoutShape({ id: `${data.id}-quarter-${index}-line`, shapeType: "rectangle", x, y: chartTop, width: 1, height: 936 - chartTop, fill: "#2E2E2E" }));
    if (index === columns) continue;
    const last = Math.min(serial + perColumn - 1, lastQuarter);
    const width = dateX(quarterDay(last + 1)) - x - 40;
    elements.push(fittedText({ id: `${data.id}-quarter-${index}-label`, text: serial === last ? quarterLabel(serial) : `${quarterLabel(serial)} – ${quarterLabel(last)}`, x: x + 20, y: chartTop + 8, width, height: 32, fontSize: 24, color: WKND_COLORS.white, opacity: 0.6 }, measure, 16));
  }
  const fills = [WKND_COLORS.blue, WKND_COLORS.orange, WKND_COLORS.yellow, WKND_COLORS.cream, WKND_COLORS.blue, WKND_COLORS.yellow];
  data.phases.forEach((phase, index) => {
    const id = `${data.id}-${phase.id}`;
    const parsedStart = parseDateInput(phase.start);
    const parsedEnd = parseDateInput(phase.end);
    const validRange = parsedStart !== null && parsedEnd !== null && parsedEnd >= parsedStart;
    const start = validRange ? parsedStart : range.start;
    const end = validRange ? parsedEnd : start + 6;
    const x = dateX(start);
    const y = barTop + index * pitch;
    const width = Math.max(4, dateX(end + 1) - x);
    const fill = fills[index % fills.length];
    const color = fill === WKND_COLORS.yellow || fill === WKND_COLORS.cream ? WKND_COLORS.black : WKND_COLORS.white;
    const title = phaseTitle(phase);
    const period = getTimelinePeriod(data, phase);
    const nameWidth = Math.ceil(measure(title, 28, 600, -0.5));
    const rangeWidth = Math.ceil(measure(period, 21));
    elements.push(createLayoutShape({ id: `${id}-bar`, shapeType: "roundedRectangle", x, y, width, height: barHeight, cornerRadius: barHeight / 2, fill }));
    if (nameWidth + rangeWidth + 70 <= width) {
      elements.push(
        fittedText({ id: `${id}-title`, text: title, x: x + 28, y, width: nameWidth + 4, height: barHeight, fontSize: 28, fontWeight: 600, letterSpacing: -0.5, verticalAlign: "middle", color }, measure),
        fittedText({ id: `${id}-period`, text: period, x: x + 28 + nameWidth + 14, y, width: width - 70 - nameWidth, height: barHeight, fontSize: 21, verticalAlign: "middle", color, opacity: 0.75 }, measure),
      );
    } else {
      const fitsStack = Math.max(nameWidth, rangeWidth) + 56 <= width;
      const rightRoom = CONTENT_RIGHT - x - width - 16;
      const leftRoom = x - gridX(1) - 16;
      const outside = !fitsStack && Math.max(rightRoom, leftRoom) >= 160;
      const labelWidth = outside ? Math.min(420, Math.max(rightRoom, leftRoom)) : Math.max(1, width - 56);
      const labelX = outside ? rightRoom >= leftRoom ? x + width + 16 : x - 16 - labelWidth : x + 28;
      const textColor = outside ? WKND_COLORS.white : color;
      elements.push(
        fittedText({ id: `${id}-title`, text: title, x: labelX, y: y + 8, width: labelWidth, height: 34, fontSize: 28, fontWeight: 600, letterSpacing: -0.5, color: textColor }, measure, 20),
        fittedText({ id: `${id}-period`, text: period, x: labelX, y: y + 44, width: labelWidth, height: 26, fontSize: 21, color: textColor, opacity: 0.75 }, measure, 16),
      );
    }
  });
  if (data.phases.length) {
    elements.push(createLayoutObject({ id: `${data.id}-object-stars`, file: "3d-stars.png", size: 164, x: 1714, y: barTop + (data.phases.length - 1) * pitch - 136 }));
  }
  return elements;
}

function getTimelineGraphicParts(
  data: TimelineData,
  measure: MeasureTimelineText,
  darkMode = data.placement === "slide",
): { graphics: SlideElement[]; decorations: SlideElement[] } {
  if (data.placement === "component") {
    const model = createTimelineModelFromPhases(data.phases);
    const graphics = (model ? createTimelineElements(model, data.id, (text, size) => measure(text, size)) : []).map((element) => {
      const styled = darkMode ? applyDarkModeToElement(element, true) : element;
      return {
        ...styled,
        ...(darkMode && styled.type === "shape" && (styled.id === `${data.id}-divider` || styled.id.startsWith(`${data.id}-guide-`))
          ? { fill: WKND_COLORS.white, stroke: WKND_COLORS.white } : {}),
        x: element.x + data.position.x - 200,
        y: element.y + data.position.y - 240,
        timelineId: data.id,
        locked: true,
      };
    });
    return { graphics, decorations: [] };
  }
  const body = data.variant === "road" ? roadElements(data, measure) : data.variant === "steps" ? stepElements(data, measure) : roadmapElements(data, measure);
  const isDecoration = (element: SlideElement) => element.id === `${data.id}-object` || element.id === `${data.id}-object-n`;
  return {
    decorations: body.filter(isDecoration),
    graphics: body.filter((element) => !isDecoration(element)).map((element) => ({
      ...(!darkMode ? applyDarkModeToElement(element, false) : element),
      timelineId: data.id,
      locked: true,
    })),
  };
}

export function createTimelineGraphicElements(
  data: TimelineData,
  measure: MeasureTimelineText = estimateTimelineText,
  darkMode = data.placement === "slide",
): SlideElement[] {
  return getTimelineGraphicParts(data, measure, darkMode).graphics;
}

export function createTimelineGraphicPreview(
  data: TimelineData,
  measure: MeasureTimelineText = estimateTimelineText,
  background?: string,
  darkMode = data.placement === "slide",
): Slide {
  const elements = createTimelineGraphicElements(data, measure, darkMode);
  const previewBackground = background ?? (data.placement === "component" ? "#FFFFFF" : data.variant === "roadmap" ? WKND_COLORS.black : WKND_COLORS.blue);
  if (!elements.length) return { id: "timeline-graphic-preview", background: previewBackground, elements: [] };
  const left = Math.min(...elements.map((element) => element.x));
  const top = Math.min(...elements.map((element) => element.y));
  const width = Math.max(...elements.map((element) => element.x + element.width)) - left;
  const height = Math.max(...elements.map((element) => element.y + element.height)) - top;
  const scale = Math.min(1792 / Math.max(1, width), 952 / Math.max(1, height));
  const x = (1920 - width * scale) / 2;
  const y = (1080 - height * scale) / 2;
  return {
    id: "timeline-graphic-preview",
    background: previewBackground,
    elements: elements.map((element) => ({
      ...element,
      x: x + (element.x - left) * scale,
      y: y + (element.y - top) * scale,
      width: element.width * scale,
      height: element.height * scale,
      ...(element.type === "text" ? {
        fontSize: element.fontSize * scale,
        letterSpacing: element.letterSpacing * scale,
        padding: (element.padding ?? 0) * scale,
      } : {}),
      ...(element.type === "shape" ? {
        strokeWidth: element.strokeWidth * scale,
        cornerRadius: (element.cornerRadius ?? 0) * scale,
      } : {}),
      ...(element.type === "image" ? { cornerRadius: element.cornerRadius * scale } : {}),
    })),
  };
}

export function createDynamicTimelineSlide(
  data: TimelineData,
  slideId: string,
  measure: MeasureTimelineText = estimateTimelineText,
  previous?: Slide,
): Slide {
  const existing = previous ? detachTimelineStaticElements(previous) : undefined;
  const darkMode = existing?.darkMode ?? (data.placement === "slide");
  const timeline: TimelineData = { ...data, graphicsOnly: true };
  const timelines = existing?.timelines?.some((item) => item.id === data.id)
    ? existing.timelines.map((item) => item.id === data.id ? timeline : item)
    : [...(existing?.timelines ?? []), timeline];
  const { graphics, decorations } = getTimelineGraphicParts(data, measure, darkMode);
  const isRoadDot = (element: SlideElement) => data.variant === "road" && isTimelineRoadDot(element);
  const dots = graphics.filter(isRoadDot);
  const content = graphics.filter((element) => !isRoadDot(element));
  let insertedDots = false;
  let insertedContent = false;
  const elements: SlideElement[] = existing ? existing.elements.flatMap((element) => {
    if (element.timelineId !== data.id) return [element];
    if (isRoadDot(element)) {
      if (insertedDots) return [];
      insertedDots = true;
      return dots;
    }
    if (insertedContent) return [];
    insertedContent = true;
    return content;
  }) : [
    ...(data.placement === "slide" ? [...createFrameElements(data.id, "light"), ...header(data, measure)] : []),
    ...dots,
    ...decorations,
    ...content,
  ].map((element) => element.timelineId ? element : {
    ...element, locked: element.role === "background" || element.type === "image",
  });
  if (existing) {
    if (!insertedDots && dots.length) {
      const contentIndex = elements.findIndex((element) => element.timelineId === data.id);
      elements.splice(contentIndex >= 0 ? contentIndex : elements.length, 0, ...dots);
    }
    if (!insertedContent) elements.push(...content);
  }
  return {
    ...existing,
    id: slideId,
    background: existing?.background ?? (data.placement === "component" ? "#FFFFFF" : data.variant === "roadmap" ? WKND_COLORS.black : WKND_COLORS.blue),
    darkMode,
    timelines,
    elements,
  };
}

export function getDynamicTimelineErrors(data: TimelineData, measure: MeasureTimelineText = estimateTimelineText): Record<string, string> {
  const errors: Record<string, string> = {};
  const elements = createTimelineGraphicElements(data, measure);
  const check = (key: string, id: string, message: string, maxLines = 1) => {
    if (errors[key]) return;
    const element = elements.find((item) => item.id === id);
    if (element?.type === "text" && !componentTextFits(element, measure, maxLines)) errors[key] = message;
  };
  const limit = getTimelinePhaseLimit(data.variant);
  if (data.phases.length < 1 || data.phases.length > limit) errors.phases = `This template fits one to ${limit} phases. Remove a phase to fit the graphic.`;
  if (data.placement === "component") {
    if (data.position.x < 0 || data.position.x > 419 || data.position.y < 0 || data.position.y > 408) errors.position = "Keep the timeline inside the slide: X from 0 to 419, Y from 0 to 408.";
  }
  let barIndex = 0;
  data.phases.forEach((phase) => {
    const error = getTimelinePhaseError(phase);
    if (!phase.title.trim()) errors[`${phase.id}.title`] = "Add a phase title.";
    else if (error) errors[`${phase.id}.dates`] = error;
    if (data.variant === "bars") {
      if (!error) {
        check(`${phase.id}.title`, `${data.id}-bar-${barIndex}-label`, "Shorten this title so it fits the timeline.");
        barIndex++;
      }
    } else {
      check(`${phase.id}.title`, `${data.id}-${phase.id}-title`, "Shorten this title to fit the selected design.");
      check(`${phase.id}.dates`, `${data.id}-${phase.id}-period`, "Use a shorter date label format for this design.");
      check(`${phase.id}.description`, `${data.id}-${phase.id}-description`, "Shorten the description to fit two lines.", 2);
    }
  });
  return errors;
}
