import { createFrameElements } from "@/lib/backgrounds/background-themes";
import { detachAgendaStaticElements } from "@/lib/agenda/agenda-ownership";
import {
  formatAgendaDate,
  formatAgendaTime,
  getAgendaActiveItemId,
  getAgendaDuration,
  getAgendaIntro,
  MAX_AGENDA_ITEMS,
  parseAgendaTime,
} from "@/lib/agenda/agenda-model";
import { createLayoutObject, createLayoutPill, createLayoutShape, WKND_COLORS } from "@/lib/layouts/layout-elements";
import { gridHeight, gridWidth, gridX, gridY, LAYOUT_GRID } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { AgendaData } from "@/types/agenda";
import type { Slide, SlideElement, TextElement } from "@/types/presentation";

export type MeasureAgendaText = (text: string, size: number, weight?: number, spacing?: number) => number;
export const estimateAgendaText: MeasureAgendaText = (text, size, weight = 400, spacing = 0) => {
  const characters = Array.from(text);
  const weightFactor = weight >= 600 ? 1.02 : 1;
  const width = characters.reduce((total, character) => {
    const ratio = /\s/.test(character) ? 0.28 : /[ilI.,'!:;]/.test(character) ? 0.26 : /[MW@]/.test(character) ? 0.85 : 0.55;
    return total + size * ratio * weightFactor;
  }, 0);
  return width + Math.max(0, characters.length - 1) * spacing;
};

const CONTENT_WIDTH = gridWidth(LAYOUT_GRID.columns);
const TABLE_X = gridX(13);
const TABLE_RIGHT = gridX(1) + CONTENT_WIDTH;
const CARD_WIDTH = gridWidth(8);
const SESSION_GAP = 12;
const SESSION_PADDING = 22;

function itemTitle(data: AgendaData, title: string) {
  return data.variant === "schedule" ? title.trim() : title.trim().replace(/\s*\n\s*/g, " ");
}

function rect(id: string, x: number, y: number, width: number, height: number, fill: string): SlideElement {
  return createLayoutShape({ id, shapeType: "rectangle", x, y, width, height, fill });
}

function header(data: AgendaData, measure: MeasureAgendaText): SlideElement[] {
  const { id, variant } = data;
  if (variant === "spotlight") {
    return [
      createLayoutObject({ id: `${id}-object`, file: "3d-arrow.png", size: 880, x: 1064, y: 8 }),
      ...createFrameElements(id, "light"),
      ...(data.label.trim() ? createLayoutPill({
        id: `${id}-pill`, text: data.label.trim(), x: gridX(1), y: gridY(1),
        width: Math.min(800, Math.ceil(measure(data.label.trim(), 24)) + 48),
        height: 50, fontSize: 24, color: WKND_COLORS.white,
      }) : []),
    ];
  }
  const light = variant === "cards";
  const chapters = variant === "chapters";
  const color = light ? WKND_COLORS.white : WKND_COLORS.black;
  const decoration = variant === "schedule"
    ? { file: "3d-d.png", size: 882, x: 1302, y: -358 }
    : chapters
      ? { file: "3d-k.png", size: 912, x: -227, y: 598 }
      : { file: "3d-w.png", size: 880, x: 1268, y: -290 };
  const intro = getAgendaIntro(data);

  return [
    createLayoutObject({ id: `${id}-object`, ...decoration }),
    ...createFrameElements(id, light ? "light" : "dark"),
    ...(data.label.trim() ? createLayoutPill({
      id: `${id}-pill`, text: data.label.trim(), x: gridX(1), y: gridY(1),
      width: Math.min(800, Math.ceil(measure(data.label.trim(), 24)) + 44), height: 50, fontSize: 24, color,
    }) : []),
    {
      ...createLayoutText({
        id: `${id}-title`, text: data.title.trim(), x: gridX(1), y: 204,
        width: gridWidth(chapters ? 10 : 12), height: chapters ? 296 : 256,
        fontSize: chapters ? 150 : 132, fontWeight: 600, lineHeight: chapters ? 0.95 : 0.94, color,
      }),
      letterSpacing: -6,
    },
    ...(variant !== "schedule" && intro ? [createLayoutText({
      id: `${id}-intro`, text: intro, x: gridX(1), y: chapters ? 516 : 476,
      width: gridWidth(chapters ? 9 : 10), height: chapters ? 72 : 32,
      fontSize: chapters ? 24 : 26, lineHeight: chapters ? 1.33 : 1.2,
      color: light ? WKND_COLORS.white : WKND_COLORS.muted, opacity: light ? 0.8 : 1,
    })] : []),
  ];
}

function chapterElements(data: AgendaData, measure: MeasureAgendaText): SlideElement[] {
  const { id } = data;
  const elements: SlideElement[] = [
    createLayoutText({ id: `${id}-header-chapter`, text: "Chapter", x: TABLE_X, y: 190, width: 160, height: 24, fontSize: 18, color: WKND_COLORS.muted }),
    createLayoutText({ id: `${id}-header-page`, text: "Page", x: TABLE_RIGHT - 160, y: 190, width: 160, height: 24, fontSize: 18, align: "right", color: WKND_COLORS.muted }),
    rect(`${id}-header-rule`, TABLE_X, 226, gridWidth(12), 2, WKND_COLORS.black),
  ];

  data.items.forEach((item, index) => {
    const prefix = `${id}-${item.id}`;
    const top = 228 + index * 106;
    const titleX = TABLE_X + 64;
    const pageWidth = item.page.trim() ? 80 : 0;
    const leaderRight = TABLE_RIGHT - pageWidth;
    const maxTitleWidth = leaderRight - titleX - 40;
    const titleWidth = Math.min(maxTitleWidth, Math.ceil(measure(itemTitle(data, item.title), 53, 600, -2)) + 8);
    const dotCount = Math.max(0, Math.floor((leaderRight - titleX - titleWidth - 28) / 12));
    elements.push(
      createLayoutText({ id: `${prefix}-number`, text: String(index + 1).padStart(2, "0"), x: TABLE_X, y: top, width: 56, height: 106, fontSize: 22, verticalAlign: "middle", color: WKND_COLORS.muted }),
      { ...createLayoutText({ id: `${prefix}-title`, text: itemTitle(data, item.title), x: titleX, y: top, width: Math.max(1, titleWidth), height: 106, fontSize: 53, fontWeight: 600, verticalAlign: "middle" }), letterSpacing: -2 },
      ...Array.from({ length: dotCount }, (_, dot) => ({
        ...createLayoutShape({ id: `${prefix}-dot-${dot}`, shapeType: "circle", x: leaderRight - 3 - dot * 12, y: top + 53 - 1.5, width: 3, height: 3, fill: WKND_COLORS.muted }), opacity: 0.6,
      })),
      ...(pageWidth ? [createLayoutText({ id: `${prefix}-page`, text: item.page.trim(), x: TABLE_RIGHT - 64, y: top, width: 64, height: 106, fontSize: 22, align: "right", verticalAlign: "middle", color: WKND_COLORS.muted })] : []),
      rect(`${prefix}-divider`, TABLE_X, top + 106, gridWidth(12), 1.5, "#E4DFCF"),
    );
  });
  return elements;
}

function cardElements(data: AgendaData): SlideElement[] {
  const height = gridHeight(2);
  return data.items.flatMap((item, index) => {
    const id = `${data.id}-${item.id}`;
    const x = gridX(1 + index % 3 * 8);
    const y = gridY(8 + Math.floor(index / 3) * 2);
    const textX = x + 132;
    const textWidth = CARD_WIDTH - 132 - 32;
    return [
      createLayoutShape({ id: `${id}-card`, shapeType: "roundedRectangle", x, y, width: CARD_WIDTH, height, cornerRadius: 20, fill: WKND_COLORS.cream }),
      { ...createLayoutText({ id: `${id}-number`, text: String(index + 1).padStart(2, "0"), x: x + 32, y, width: 100, height, fontSize: 62, fontWeight: 600, lineHeight: 1, verticalAlign: "middle", color: WKND_COLORS.blue }), letterSpacing: -2 },
      { ...createLayoutText({ id: `${id}-title`, text: itemTitle(data, item.title), x: textX, y: y + (item.description.trim() ? 26 : 40), width: textWidth, height: 40, fontSize: 32, fontWeight: 600 }), letterSpacing: -1 },
      ...(item.description.trim() ? [createLayoutText({ id: `${id}-description`, text: item.description.trim(), x: textX, y: y + 72, width: textWidth, height: 26, fontSize: 20, color: WKND_COLORS.muted })] : []),
    ];
  });
}

function spotlightElements(data: AgendaData, measure: MeasureAgendaText, darkMode: boolean): SlideElement[] {
  const activeId = getAgendaActiveItemId(data);
  const elements: SlideElement[] = [];
  const titleX = gridX(1) + 84;
  const textWidth = gridWidth(12) - 84;
  let top = 288;
  data.items.forEach((item, index) => {
    const id = `${data.id}-${item.id}`;
    const active = item.id === activeId;
    const title = itemTitle(data, item.title);
    const circleY = top + (active ? 28 : 0);
    const spacing = active ? -0.04 : -0.03;
    let fontSize = active ? 84 : 46;
    while (fontSize > (active ? 56 : 36) && measure(title, fontSize, 600, fontSize * spacing) > textWidth) fontSize--;
    elements.push(
      createLayoutShape({
        id: `${id}-circle`, shapeType: "circle", x: gridX(1), y: circleY,
        width: 56, height: 56, fill: active ? "#F13F00" : "transparent",
        stroke: active ? "#F13F00" : "#666666", strokeWidth: active ? 0 : 1.5,
      }),
      createLayoutText({
        id: `${id}-number`, text: String(index + 1).padStart(2, "0"),
        x: gridX(1), y: circleY, width: 56, height: 56,
        fontSize: 22, fontWeight: active ? 600 : 400, align: "center", verticalAlign: "middle",
        color: active ? WKND_COLORS.white : darkMode ? "#888888" : WKND_COLORS.muted,
      }),
      {
        ...createLayoutText({
          id: `${id}-title`, text: title, x: titleX, y: top,
          width: textWidth, height: active ? 92 : 56,
          fontSize, fontWeight: 600, lineHeight: 1.05, verticalAlign: "middle",
          color: active ? darkMode ? WKND_COLORS.white : WKND_COLORS.black : "#666666",
        }),
        letterSpacing: fontSize * spacing,
      },
      ...(active && item.description.trim() ? [createLayoutText({
        id: `${id}-description`, text: item.description.trim(),
        x: titleX, y: top + 96, width: textWidth, height: 32,
        fontSize: 23, lineHeight: 1.25, color: darkMode ? "#B3B3B3" : WKND_COLORS.muted,
      })] : []),
    );
    top += active ? 144 : 84;
  });
  return elements;
}

function defaultBackground(data: AgendaData) {
  return data.variant === "schedule" ? WKND_COLORS.yellow
    : data.variant === "chapters" ? WKND_COLORS.cream
    : data.variant === "spotlight" ? WKND_COLORS.black : WKND_COLORS.blue;
}

function scheduleMeta(data: AgendaData) {
  const start = parseAgendaTime(data.startTime) ?? 540;
  const total = getAgendaDuration(data);
  return [
    formatAgendaDate(data.date),
    `${formatAgendaTime(start)} – ${formatAgendaTime(start + total)}`,
    data.location.trim(),
  ].filter(Boolean);
}

function scheduleMetaElements(data: AgendaData, measure: MeasureAgendaText): SlideElement[] {
  const elements: SlideElement[] = [];
  let metaX = gridX(1);
  scheduleMeta(data).forEach((text, index) => {
    const width = Math.ceil(measure(text, 22)) + 36;
    elements.push(...createLayoutPill({ id: `${data.id}-meta-${index}`, text, x: metaX, y: gridY(6), width, height: 44, fontSize: 22 }));
    metaX += width + 12;
  });
  return elements;
}

function scheduleElements(data: AgendaData): SlideElement[] {
  const { id } = data;
  const start = parseAgendaTime(data.startTime) ?? 540;
  // A partial draft still gets a finite, readable preview.
  const durations = data.items.map((item) => Math.max(1, Number.isFinite(item.durationMinutes) ? item.durationMinutes : 1));
  const total = Math.max(1, durations.reduce((sum, minutes) => sum + minutes, 0));
  const timeX = (offset: number) => gridX(1) + offset / total * CONTENT_WIDTH;
  const elements: SlideElement[] = [];

  elements.push(rect(`${id}-axis`, gridX(1), 628, CONTENT_WIDTH, 1.5, WKND_COLORS.black));
  const labelStep = [5, 10, 15, 30, 60, 120, 180, 240].find((step) => Math.ceil(total / step) <= 6) ?? 240;
  const tickStep = labelStep % 2 === 0 ? labelStep / 2 : labelStep;
  const offsets = new Set<number>([0, total]);
  for (let offset = tickStep; offset < total; offset += tickStep) offsets.add(offset);
  [...offsets].sort((a, b) => a - b).forEach((offset) => {
    const x = timeX(offset);
    const first = offset === 0;
    const last = offset === total;
    const labelled = first || last || (offset % labelStep === 0 && CONTENT_WIDTH - (x - gridX(1)) > 96);
    elements.push({ ...rect(`${id}-tick-${offset}`, x - 0.75, 618, 1.5, 10, WKND_COLORS.black), opacity: labelled ? 1 : 0.5 });
    if (labelled) elements.push(createLayoutText({ id: `${id}-time-${offset}`, text: formatAgendaTime(start + offset), x: first ? x : last ? x - 80 : x - 40, y: 584, width: 80, height: 24, fontSize: 18, align: first ? "left" : last ? "right" : "center", opacity: 0.7 }));
  });

  let offset = 0;
  data.items.forEach((item, index) => {
    const prefix = `${id}-${item.id}`;
    const x = timeX(offset);
    const width = Math.max(1, durations[index] / total * CONTENT_WIDTH - (index === data.items.length - 1 ? 0 : SESSION_GAP));
    const isBreak = item.kind === "break";
    const fill = isBreak ? "transparent" : item.highlighted ? WKND_COLORS.blue : WKND_COLORS.black;
    const color = isBreak ? WKND_COLORS.black : WKND_COLORS.white;
    const textX = x + SESSION_PADDING;
    const textWidth = Math.max(1, width - SESSION_PADDING * 2);
    elements.push(
      createLayoutShape({ id: `${prefix}-card`, shapeType: "roundedRectangle", x, y: 648, width, height: 228, cornerRadius: 16, fill, ...(isBreak ? { stroke: WKND_COLORS.black, strokeWidth: 2, dashed: true } : {}) }),
      createLayoutText({ id: `${prefix}-start`, text: formatAgendaTime(start + offset), x: textX, y: 670, width: textWidth, height: 24, fontSize: 19, color, opacity: 0.7 }),
      { ...createLayoutText({ id: `${prefix}-title`, text: item.title.trim(), x: textX, y: 698, width: textWidth, height: 64, fontSize: 26, fontWeight: 600, lineHeight: 1.12, color }), letterSpacing: -0.5 },
      createLayoutText({ id: `${prefix}-duration`, text: `${item.durationMinutes} min`, x: textX, y: 826, width: textWidth, height: 24, fontSize: 19, color }),
    );
    offset += durations[index];
  });
  return elements;
}

export function createAgendaGraphicElements(
  data: AgendaData,
  measure: MeasureAgendaText = estimateAgendaText,
  darkMode = data.variant === "cards" || data.variant === "spotlight",
): SlideElement[] {
  const elements = data.variant === "schedule" ? scheduleElements(data)
    : data.variant === "chapters" ? chapterElements(data, measure)
    : data.variant === "spotlight" ? spotlightElements(data, measure, darkMode) : cardElements(data);
  return elements.map((element) => {
    let styled = element;
    if (darkMode && data.variant === "chapters") {
      if (element.type === "text") styled = {
        ...element,
        color: WKND_COLORS.white,
        opacity: element.color === WKND_COLORS.muted ? 0.7 : element.opacity,
      };
      if (element.type === "shape") styled = {
        ...element,
        fill: WKND_COLORS.white,
        stroke: WKND_COLORS.white,
        opacity: element.id.endsWith("-divider") ? 0.25 : element.opacity,
      };
    } else if (darkMode && data.variant === "schedule") {
      if (element.type === "text" && element.color === WKND_COLORS.black) styled = { ...element, color: WKND_COLORS.white };
      if (element.type === "shape" && (element.id === `${data.id}-axis` || element.id.startsWith(`${data.id}-tick-`))) styled = { ...element, fill: WKND_COLORS.white, stroke: WKND_COLORS.white };
      if (element.type === "shape" && element.fill === "transparent") styled = { ...element, stroke: WKND_COLORS.white };
    }
    return { ...styled, agendaId: data.id, locked: true };
  });
}

export function createAgendaGraphicPreview(
  data: AgendaData,
  measure: MeasureAgendaText = estimateAgendaText,
  background?: string,
  darkMode = data.variant === "cards" || data.variant === "spotlight",
): Slide {
  const elements = createAgendaGraphicElements(data, measure, darkMode);
  if (!elements.length) return { id: "agenda-graphic-preview", background: background ?? "#FFFFFF", elements: [] };
  const left = Math.min(...elements.map((element) => element.x));
  const top = Math.min(...elements.map((element) => element.y));
  const width = Math.max(...elements.map((element) => element.x + element.width)) - left;
  const height = Math.max(...elements.map((element) => element.y + element.height)) - top;
  const scale = Math.min(1792 / Math.max(1, width), 952 / Math.max(1, height));
  const x = (1920 - width * scale) / 2;
  const y = (1080 - height * scale) / 2;
  return {
    id: "agenda-graphic-preview",
    background: background ?? defaultBackground(data),
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
    })),
  };
}

export function createAgendaSlide(data: AgendaData, slideId: string, measure: MeasureAgendaText = estimateAgendaText, previous?: Slide): Slide {
  const existing = previous ? detachAgendaStaticElements(previous) : undefined;
  const background = defaultBackground(data);
  const darkMode = existing?.darkMode ?? (data.variant === "cards" || data.variant === "spotlight");
  const graphic = createAgendaGraphicElements(data, measure, darkMode);
  let inserted = false;
  const elements: SlideElement[] = existing ? existing.elements.flatMap((element) => {
    if (element.agendaId !== data.id) return [element];
    if (inserted) return [];
    inserted = true;
    return graphic;
  }) : [
    // Initial slide copy stays independent of future edits to the graphic.
    ...header(data, measure),
    ...(data.variant === "schedule" ? scheduleMetaElements(data, measure) : []),
  ].map((element) => ({ ...element, locked: element.role === "background" || (data.variant === "spotlight" && element.type === "image") }));
  if (!inserted) elements.push(...graphic);
  return {
    ...existing,
    id: slideId,
    background: existing?.background ?? background,
    darkMode,
    agenda: { ...data, graphicsOnly: true },
    elements,
  };
}

function textFits(element: TextElement, measure: MeasureAgendaText, maxLines?: number) {
  const width = (text: string) => measure(text, element.fontSize, element.fontWeight, element.letterSpacing);
  let lineCount = 0;
  for (const paragraph of element.text.split("\n")) {
    let line = "";
    lineCount++;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (width(word) > element.width) return false;
      const next = line ? `${line} ${word}` : word;
      if (line && width(next) > element.width) {
        lineCount++;
        line = word;
      } else line = next;
    }
  }
  return lineCount <= (maxLines ?? Math.floor((element.height + 0.5) / (element.fontSize * element.lineHeight)));
}

export function getAgendaErrors(data: AgendaData, measure: MeasureAgendaText = estimateAgendaText): Record<string, string> {
  const errors: Record<string, string> = {};
  const elements = createAgendaGraphicElements(data, measure);
  const check = (key: string, id: string, message: string, maxLines?: number) => {
    if (errors[key]) return;
    const element = elements.find((element) => element.id === id);
    if (element?.type === "text" && !textFits(element, measure, maxLines)) errors[key] = message;
  };
  if (data.items.length < 1 || data.items.length > MAX_AGENDA_ITEMS) errors.items = "Add between one and six agenda items.";
  if (data.variant === "spotlight" && data.items.filter((item) => item.highlighted).length !== 1) errors.activeItem = "Choose one active topic.";

  data.items.forEach((item) => {
    const prefix = `${data.id}-${item.id}`;
    if (!item.title.trim()) errors[`${item.id}.title`] = "Add an item title.";
    else check(`${item.id}.title`, `${prefix}-title`, data.variant === "schedule" ? "This session is too narrow for its title. Shorten the title or increase its duration." : "Shorten the title to fit one line in this design.", data.variant === "schedule" ? 2 : 1);
    if (data.variant === "cards" || data.variant === "spotlight") check(`${item.id}.description`, `${prefix}-description`, "Shorten the description to fit one line.", 1);
    if (data.variant === "chapters" && item.page.trim()) {
      if (!/^[1-9]\d{0,3}$/.test(item.page.trim())) errors[`${item.id}.page`] = "Use a page number from 1 to 9999, or leave it empty.";
      else check(`${item.id}.page`, `${prefix}-page`, "The page number is too wide.", 1);
    }
    if (data.variant === "schedule") {
      if (!Number.isInteger(item.durationMinutes) || item.durationMinutes < 1 || item.durationMinutes > 1439) errors[`${item.id}.duration`] = "Use a duration between 1 and 1439 minutes.";
      check(`${item.id}.duration`, `${prefix}-duration`, "Increase this session's duration so its details fit.", 1);
      check(`${item.id}.duration`, `${prefix}-start`, "Increase this session's duration so its time fits.", 1);
    }
  });
  if (data.variant === "schedule") {
    const start = parseAgendaTime(data.startTime);
    if (start === null) errors.startTime = "Choose a start time.";
    else if (start + getAgendaDuration(data) > 1439) errors.startTime = "All sessions must end before midnight on the same day.";
  }
  return errors;
}
