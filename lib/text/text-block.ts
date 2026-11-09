import { createUniqueId } from "@/lib/id";
import { createLayoutText } from "@/lib/layouts/layout-text";
import { estimateComponentText } from "@/lib/text/component-text";
import { measureTextWidth } from "@/lib/text/measure-text";
import type { Presentation, Slide, SlideElement, TextElement } from "@/types/presentation";
import type { TextBlockContent, TextBlockData, TextBlockLayoutUpdates, TextBlockPart, TextBlockTemplate } from "@/types/text-block";

export const TEXT_BLOCK_TEMPLATES: readonly { id: TextBlockTemplate; name: string; description: string }[] = [
  { id: "title", name: "Title only", description: "A standalone headline" },
  { id: "title-body", name: "Title + paragraph", description: "Title above paragraph" },
  { id: "body-title", name: "Paragraph + title", description: "Paragraph above title" },
  { id: "title-beside-body", name: "Title beside paragraph", description: "Title left, paragraph right" },
  { id: "body-beside-title", name: "Paragraph beside title", description: "Paragraph left, title right" },
];

export function isHorizontalTextBlock(template: TextBlockTemplate) { return template.includes("beside"); }
export function minTextBlockWidth(template: TextBlockTemplate) { return isHorizontalTextBlock(template) ? 640 : 240; }

function content(text: string, title: boolean, darkMode: boolean): TextBlockContent {
  return {
    text, fontFamily: "Plus Jakarta Sans", fontSize: title ? 72 : 28,
    fontWeight: title ? 600 : 400, italic: false,
    color: darkMode ? "#FFFFFF" : "#111111",
    align: "left", lineHeight: title ? 1.08 : 1.45,
    letterSpacing: title ? -2.5 : 0, opacity: title ? 1 : 0.72, textDecoration: "none",
  };
}

export function createTextBlock(template: TextBlockTemplate, darkMode = false): TextBlockData {
  const horizontal = isHorizontalTextBlock(template);
  const data: TextBlockData = {
    version: 1, id: createUniqueId("component"), template,
    x: horizontal ? 288 : template === "title" ? 440 : 516, y: 360,
    width: horizontal ? 1344 : template === "title" ? 1040 : 888,
    gap: horizontal ? 64 : 32,
    title: content("Write your title here", true, darkMode),
    ...(template !== "title" ? { body: content("Use this space to introduce your idea, explain the context, and highlight what matters most to your audience.", false, darkMode) } : {}),
  };
  if (template === "title") { data.title.fontSize = 96; data.title.letterSpacing = -3.8; }
  const height = getTextBlockBounds(data).height;
  data.y = Math.max(120, Math.round((1080 - height) / 2));
  return data;
}

export function cloneTextBlock(data: TextBlockData, freshId = false, offset = 0): TextBlockData {
  return { ...data, id: freshId ? createUniqueId("component") : data.id, x: data.x + offset, y: data.y + offset, title: { ...data.title }, ...(data.body ? { body: { ...data.body } } : {}) };
}

function textHeight(data: TextBlockContent, width: number) {
  const measure = (text: string) => {
    const measured = measureTextWidth(text, data.fontFamily, data.fontSize, data.fontWeight >= 600 ? 700 : 400, data.italic);
    return measured === null ? estimateComponentText(text, data.fontSize, data.fontWeight, data.letterSpacing)
      : measured + Math.max(0, Array.from(text).length - 1) * data.letterSpacing;
  };
  let lines = 0;
  for (const paragraph of data.text.split("\n")) {
    lines++;
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next) <= width) { line = next; continue; }
      if (line) { lines++; line = ""; }
      if (measure(word) <= width) { line = word; continue; }
      // Canvas word wrapping also breaks words that exceed an entire line.
      for (const character of Array.from(word)) {
        if (line && measure(line + character) > width) { lines++; line = character; }
        else line += character;
      }
    }
  }
  return Math.ceil(Math.max(1, lines) * data.fontSize * data.lineHeight) + 3;
}

export function createTextBlockElements(data: TextBlockData, previous: readonly SlideElement[] = []): TextElement[] {
  const horizontal = isHorizontalTextBlock(data.template);
  const titleFirst = data.template === "title" || data.template === "title-body" || data.template === "title-beside-body";
  const available = Math.max(1, data.width - (horizontal ? data.gap : 0));
  const titleWidth = horizontal ? available * 0.42 : data.width;
  const bodyWidth = horizontal ? available - titleWidth : data.width;
  const titleHeight = textHeight(data.title, titleWidth);
  const bodyHeight = data.body ? textHeight(data.body, bodyWidth) : 0;
  const parts: { part: TextBlockPart; value: TextBlockContent; x: number; y: number; width: number; height: number }[] = [{
    part: "title", value: data.title, width: titleWidth, height: titleHeight,
    x: data.x + (horizontal && !titleFirst ? bodyWidth + data.gap : 0),
    y: data.y + (!horizontal && !titleFirst && data.body ? bodyHeight + data.gap : 0),
  }];
  if (data.body) parts.push({
    part: "body", value: data.body, width: bodyWidth, height: bodyHeight,
    x: data.x + (horizontal && titleFirst ? titleWidth + data.gap : 0),
    y: data.y + (!horizontal && titleFirst ? titleHeight + data.gap : 0),
  });
  return parts.map(({ part, value, x, y, width, height }) => ({
    ...createLayoutText({ id: previous.find((element) => element.textBlockId === data.id && element.textBlockPart === part)?.id ?? `${data.id}-${part}`, text: value.text, x, y, width, height, fontSize: value.fontSize }),
    ...value, textBlockId: data.id, textBlockPart: part,
  }));
}

export function getTextBlockBounds(data: TextBlockData) {
  const elements = createTextBlockElements(data);
  return { x: data.x, y: data.y, width: data.width, height: Math.max(...elements.map((element) => element.y + element.height)) - data.y };
}

export function upsertTextBlock(slide: Slide, data: TextBlockData): Slide {
  const elements = createTextBlockElements(data, slide.elements);
  let inserted = false;
  const next = slide.elements.flatMap((element) => {
    if (element.textBlockId !== data.id) return [element];
    if (inserted) return [];
    inserted = true;
    return elements;
  });
  if (!inserted) next.push(...elements);
  return {
    ...slide, elements: next,
    textBlocks: slide.textBlocks?.some((block) => block.id === data.id)
      ? slide.textBlocks.map((block) => block.id === data.id ? data : block) : [...(slide.textBlocks ?? []), data],
  };
}

export function updateTextBlockLayout(data: TextBlockData, updates: TextBlockLayoutUpdates): TextBlockData {
  const next = cloneTextBlock(data);
  for (const key of ["x", "y", "width", "gap"] as const) if (typeof updates[key] === "number" && Number.isFinite(updates[key])) next[key] = updates[key];
  next.width = Math.max(minTextBlockWidth(next.template), Math.min(1800, next.width));
  next.gap = Math.max(0, Math.min(240, next.gap));
  if (updates.align && ["left", "center", "right", "justify"].includes(updates.align)) {
    next.title.align = updates.align;
    if (next.body) next.body.align = updates.align;
  }
  return next;
}

const CONTENT_KEYS = ["text", "fontFamily", "fontSize", "fontWeight", "italic", "color", "align", "lineHeight", "letterSpacing", "opacity", "textDecoration"] as const;
export function textBlockContent(element: TextBlockContent): TextBlockContent {
  return Object.fromEntries(CONTENT_KEYS.map((key) => [key, element[key]])) as TextBlockContent;
}

export function updateTextBlockPart(data: TextBlockData, part: TextBlockPart, updates: Partial<TextElement>): TextBlockData {
  const next = cloneTextBlock(data);
  const value = next[part];
  if (!value) return data;
  next[part] = textBlockContent({ ...value, ...Object.fromEntries(CONTENT_KEYS.filter((key) => updates[key] !== undefined).map((key) => [key, updates[key]])) });
  return next;
}

// Clipboard elements retain their semantic roles, so a pasted combination
// can recover its layout and styles without depending on the source slide.
export function textBlocksFromElements(elements: readonly SlideElement[]): TextBlockData[] {
  const ids = new Set(elements.flatMap((element) => element.textBlockId ? [element.textBlockId] : []));
  return [...ids].flatMap((id) => {
    const title = elements.find((element): element is TextElement => element.type === "text" && element.textBlockId === id && element.textBlockPart === "title");
    const body = elements.find((element): element is TextElement => element.type === "text" && element.textBlockId === id && element.textBlockPart === "body");
    if (!title) return [];
    const horizontal = body && Math.abs(title.x - body.x) > 1;
    const first = !body || (horizontal ? title.x < body.x : title.y < body.y);
    const template: TextBlockTemplate = !body ? "title" : horizontal ? first ? "title-beside-body" : "body-beside-title" : first ? "title-body" : "body-title";
    const x = Math.min(title.x, body?.x ?? title.x);
    const y = Math.min(title.y, body?.y ?? title.y);
    const data: TextBlockData = { version: 1, id, template, x, y,
      width: horizontal && body ? Math.max(title.x + title.width, body.x + body.width) - x : title.width,
      gap: body ? Math.max(0, horizontal ? first ? body.x - title.x - title.width : title.x - body.x - body.width : first ? body.y - title.y - title.height : title.y - body.y - body.height) : 0,
      title: textBlockContent(title), ...(body ? { body: textBlockContent(body) } : {}),
    };
    return [updateTextBlockLayout(data, {})];
  });
}

export function reflowTextBlockPresentation(presentation: Presentation): Presentation {
  let changed = false;
  const slides = presentation.slides.map((slide) => {
    if (!slide.textBlocks?.length) return slide;
    let next = slide;
    for (const block of slide.textBlocks ?? []) next = upsertTextBlock(next, block);
    const owned = (elements: readonly SlideElement[]) => elements.filter((element) => element.textBlockId);
    if (JSON.stringify(owned(next.elements)) === JSON.stringify(owned(slide.elements))) return slide;
    changed = true; return next;
  });
  return changed ? { ...presentation, slides } : presentation;
}

export function isTextBlockData(value: unknown): value is TextBlockData {
  if (!value || typeof value !== "object") return false;
  const data = value as TextBlockData;
  const validContent = (value: TextBlockContent) => value && typeof value === "object" && typeof value.text === "string" && typeof value.fontFamily === "string" &&
    Number.isFinite(value.fontSize) && value.fontSize >= 8 && value.fontSize <= 300 && Number.isFinite(value.fontWeight) && typeof value.italic === "boolean" && typeof value.color === "string" &&
    ["left", "center", "right", "justify"].includes(value.align) && Number.isFinite(value.lineHeight) && value.lineHeight >= 0.5 && value.lineHeight <= 4 && Number.isFinite(value.letterSpacing) &&
    Number.isFinite(value.opacity) && value.opacity >= 0 && value.opacity <= 1 && (value.textDecoration === undefined || ["none", "underline"].includes(value.textDecoration));
  return data.version === 1 && typeof data.id === "string" && !!data.id && TEXT_BLOCK_TEMPLATES.some((template) => template.id === data.template) &&
    Number.isFinite(data.x) && Number.isFinite(data.y) && Number.isFinite(data.width) && data.width >= minTextBlockWidth(data.template) && data.width <= 1800 &&
    Number.isFinite(data.gap) && data.gap >= 0 && data.gap <= 240 && !!validContent(data.title) &&
    (data.template === "title" ? data.body === undefined : !!validContent(data.body!));
}
