import { buildComponentSlide, buildTableData, COMPONENT_LAYOUTS, type ComponentContext } from "@/lib/deck-spec/component-layouts";
import type { DeckBuildResult, DeckSpec, DeckSpecIssue, DeckTextMeasure } from "@/lib/deck-spec/deck-spec";
import {
  STATIC_LAYOUT_CONTENT,
  TABLE_HEADER_FIELDS,
  type StaticField,
  type StaticImageField,
  type StaticTextField,
} from "@/lib/deck-spec/static-layouts";
import { createUniqueId } from "@/lib/id";
import { gridWidth } from "@/lib/layouts/layout-grid";
import { SLIDE_LAYOUTS } from "@/lib/layouts/layout-registry";
import { duplicateSlideWithNewIds } from "@/lib/slides/slide-utils";
import { updateTableSlide } from "@/lib/table/table-elements";
import { componentTextFits, estimateComponentText } from "@/lib/text/component-text";
import { applyThemeToSlide } from "@/lib/themes/apply-theme";
import { isThemeId, THEME_IDS, type ThemeId } from "@/lib/themes/deck-themes";
import {
  PRESENTATION_ASPECT_RATIO,
  PRESENTATION_HEIGHT,
  PRESENTATION_WIDTH,
  type Presentation,
  type Slide,
  type SlideElement,
  type TextElement,
} from "@/types/presentation";

export const MAX_DECK_SLIDES = 60;
const PILL_PADDING = 48;
const SAMPLE_TEXT = "the quick brown fox jumps over the lazy dog";

interface BuildContext extends ComponentContext {
  measure: DeckTextMeasure;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isImageSource(value: string) {
  return /^https?:\/\/\S+$/i.test(value) || /^data:image\/[a-z+.-]+;base64,/i.test(value) || /^\/assets\/\S+$/.test(value);
}

// Roughly how many characters fit in a text element, for error messages and
// the catalog.
export function estimateTextCapacity(element: TextElement, measure: DeckTextMeasure = estimateComponentText) {
  const averageWidth = measure(SAMPLE_TEXT, element.fontSize, element.fontWeight, element.letterSpacing) / SAMPLE_TEXT.length;
  const lines = Math.max(1, Math.floor((element.height + 0.5) / (element.fontSize * element.lineHeight)));
  return { lines, characters: Math.max(1, Math.floor(element.width / averageWidth) * lines) };
}

// Fills a fixed layout's template elements, which still carry their template
// ids ("<layoutId>-<element>"), from `content`.
function applyStaticFields(
  slide: Slide,
  layoutId: string,
  fields: Record<string, StaticField>,
  content: Record<string, unknown>,
  path: string,
  context: BuildContext,
): Slide {
  const elements = new Map(slide.elements.map((element) => [element.id, element]));
  const removed = new Set<string>();
  const placeholderImages: string[] = [];
  const fullId = (suffix: string) => `${layoutId}-${suffix}`;

  const remove = (suffix: string) => removed.add(fullId(suffix));
  const update = (suffix: string, changes: Partial<SlideElement>) => {
    const id = fullId(suffix);
    const element = elements.get(id);
    if (!element) throw new Error(`Layout ${layoutId} has no element "${suffix}".`);
    elements.set(id, { ...element, ...changes } as SlideElement);
    return elements.get(id)!;
  };

  const applyText = (field: StaticTextField, suffix: string, value: unknown, fieldPath: string) => {
    let text: string | undefined;
    if (field.lines) {
      if (Array.isArray(value) && value.length === field.lines && value.every((line) => typeof line === "string")) {
        text = value.map((line: string) => line.trim()).join("\n");
      } else if (value !== undefined && value !== null) {
        context.errors.push({ path: fieldPath, message: `Use an array of exactly ${field.lines} short lines.` });
        return;
      }
    } else if (typeof value === "string" || typeof value === "number") {
      text = String(value).trim();
    } else if (value !== undefined && value !== null) {
      context.errors.push({ path: fieldPath, message: "Use a text string." });
      return;
    }

    if (!text) {
      if (field.required) context.errors.push({ path: fieldPath, message: "This field is required." });
      else if (field.fallback !== "keep") {
        remove(suffix);
        field.removeWith?.forEach(remove);
        if (field.pill) remove(suffix.replace(/-label$/, "-outline"));
      }
      return;
    }

    const element = update(suffix, { text }) as TextElement;
    if (field.pill) {
      const width = Math.min(gridWidth(8), Math.ceil(context.measure(text, element.fontSize, element.fontWeight)) + PILL_PADDING);
      // Centered pills (e.g. on covers) stay centered as they resize.
      const centered = Math.abs(element.x + element.width / 2 - PRESENTATION_WIDTH / 2) < 2;
      const x = centered ? Math.round((PRESENTATION_WIDTH - width) / 2) : element.x;
      update(suffix, { width, x });
      update(suffix.replace(/-label$/, "-outline"), { width, x });
      return;
    }
    if (!componentTextFits(element, context.measure)) {
      const capacity = estimateTextCapacity(element, context.measure);
      context.errors.push({
        path: fieldPath,
        message: `Too long for this layout: about ${capacity.characters} characters fit on ${capacity.lines} line${capacity.lines === 1 ? "" : "s"} (got ${text.length}). Shorten it.`,
      });
    }
  };

  const applyImage = (field: StaticImageField, suffix: string, value: unknown, fieldPath: string) => {
    if (value === undefined || value === null || value === "") {
      placeholderImages.push(fieldPath);
      return;
    }
    if (typeof value !== "string" || !isImageSource(value.trim())) {
      context.errors.push({ path: fieldPath, message: "Use an https:// image URL or a data:image/… URL." });
      return;
    }
    const element = elements.get(fullId(suffix));
    if (element?.type !== "image") throw new Error(`Layout ${layoutId} has no image "${suffix}".`);
    // The renderer reads the real size once the image loads.
    const next = { ...element, src: value.trim(), fit: "cover" as const };
    delete next.originalWidth;
    delete next.originalHeight;
    elements.set(element.id, next);
  };

  for (const [key, field] of Object.entries(fields)) {
    const value = content[key];
    const fieldPath = `${path}.${key}`;
    if (field.type === "text") applyText(field, field.element, value, fieldPath);
    else if (field.type === "image") applyImage(field, field.element, value, fieldPath);
    else {
      if (!Array.isArray(value) || value.length < field.min || value.length > field.max) {
        const count = field.min === field.max ? `exactly ${field.min}` : `${field.min}–${field.max}`;
        context.errors.push({ path: fieldPath, message: `Use an array of ${count} items${Array.isArray(value) ? `; got ${value.length}` : ""}.` });
        continue;
      }
      for (let index = 0; index < field.max; index++) {
        const itemKey = field.keys?.[index] ?? String(index + 1);
        const withKey = (suffix: string) => suffix.replaceAll("{n}", itemKey);
        if (index >= value.length) {
          const prefix = fullId(withKey(field.itemPrefix));
          for (const id of elements.keys()) if (id.startsWith(prefix)) removed.add(id);
          continue;
        }
        const item = value[index];
        const itemPath = `${fieldPath}[${index}]`;
        if (!isRecord(item)) {
          context.errors.push({ path: itemPath, message: `Each item is an object with: ${Object.keys(field.fields).join(", ")}.` });
          continue;
        }
        for (const [itemKeyName, itemField] of Object.entries(field.fields)) {
          const suffix = withKey(itemField.element);
          if (itemField.type === "text") applyText(itemField, suffix, item[itemKeyName], `${itemPath}.${itemKeyName}`);
          else applyImage(itemField, suffix, item[itemKeyName], `${itemPath}.${itemKeyName}`);
        }
      }
    }
  }

  if (placeholderImages.length) {
    context.warnings.push({ path, message: `Placeholder photos are used for: ${placeholderImages.map((item) => item.slice(path.length + 1)).join(", ")}.` });
  }
  return { ...slide, elements: [...elements.values()].filter((element) => !removed.has(element.id)) };
}

function applyFooter(slide: Slide, footer: DeckSpec["footer"]): Slide {
  if (!footer || (footer.left === undefined && footer.note === undefined)) return slide;
  return {
    ...slide,
    elements: slide.elements.map((element) => {
      if (element.type !== "text" || element.role !== "background") return element;
      if (footer.left !== undefined && element.id.endsWith("-footer-left")) return { ...element, text: footer.left };
      if (footer.note !== undefined && element.id.endsWith("-footer-note")) return { ...element, text: footer.note };
      return element;
    }),
  };
}

export function getKnownLayoutIds() {
  return [
    ...STATIC_LAYOUT_CONTENT.map((layout) => layout.layoutId),
    ...COMPONENT_LAYOUTS.map((layout) => layout.layoutId),
  ];
}

const COMPONENT_FIELDS: Record<string, readonly string[]> = {
  agenda: ["eyebrow", "title", "intro", "items", "date", "location", "startTime"],
  team: ["eyebrow", "title", "intro", "leader", "groups"],
  timeline: ["eyebrow", "title", "intro", "periodFormat", "phases"],
  table: [...Object.keys(TABLE_HEADER_FIELDS), "table"],
};

function warnUnknownFields(content: Record<string, unknown>, known: readonly string[], path: string, context: BuildContext) {
  const unknown = Object.keys(content).filter((key) => !known.includes(key));
  if (unknown.length) {
    context.warnings.push({ path, message: `Ignored unknown field${unknown.length === 1 ? "" : "s"} ${unknown.join(", ")}. This layout takes: ${known.join(", ")}.` });
  }
}

// Template element ids are replaced by random ones when a slide is
// instantiated, so the footer is filled while they still end in
// "-footer-left" / "-footer-note".
function buildSlide(layoutId: string, content: Record<string, unknown>, path: string, footer: DeckSpec["footer"], context: BuildContext): Slide | null {
  const template = SLIDE_LAYOUTS.find((layout) => layout.id === layoutId);
  const fixed = STATIC_LAYOUT_CONTENT.find((layout) => layout.layoutId === layoutId);
  const component = COMPONENT_LAYOUTS.find((layout) => layout.layoutId === layoutId);
  if (!template || (!fixed && !component)) {
    context.errors.push({ path: `${path}.layout`, message: `Unknown layout "${layoutId}". Use one of: ${getKnownLayoutIds().join(", ")}.` });
    return null;
  }

  if (fixed) {
    warnUnknownFields(content, Object.keys(fixed.fields), `${path}.content`, context);
    const filled = applyStaticFields(structuredClone(template.slide), layoutId, fixed.fields, content, `${path}.content`, context);
    return duplicateSlideWithNewIds(applyFooter(filled, footer));
  }

  warnUnknownFields(content, COMPONENT_FIELDS[component!.kind], `${path}.content`, context);
  if (component!.kind !== "table") {
    const slide = buildComponentSlide(component!, content, `${path}.content`, context);
    return slide && applyFooter(slide, footer);
  }

  // Tables: fixed header elements plus a generated table.
  const templateSlide = structuredClone(template.slide);
  const table = templateSlide.table && buildTableData(component!.variant, templateSlide.table.id, content, `${path}.content`, context);
  if (!table) return null;
  const filled = applyStaticFields(templateSlide, layoutId, TABLE_HEADER_FIELDS, content, `${path}.content`, context);
  return duplicateSlideWithNewIds(applyFooter(updateTableSlide(filled, table), footer));
}

// Builds a WKND presentation from a deck spec. Pass the editor's canvas text
// measure in the browser for exact fit checks; elsewhere a close estimate is
// used.
export function buildDeckFromSpec(input: unknown, measure: DeckTextMeasure = estimateComponentText): DeckBuildResult {
  const errors: DeckSpecIssue[] = [];
  const warnings: DeckSpecIssue[] = [];
  const context: BuildContext = { measure, errors, warnings };
  const slides: Slide[] = [];
  const spec = isRecord(input) ? input : {};
  const title = typeof spec.title === "string" && spec.title.trim() ? spec.title.trim() : "Untitled Presentation";
  const presentation = (): Presentation => ({
    schemaVersion: 1 as const,
    id: createUniqueId("component").replace(/^component-/, "presentation-"),
    title,
    aspectRatio: PRESENTATION_ASPECT_RATIO,
    width: PRESENTATION_WIDTH,
    height: PRESENTATION_HEIGHT,
    slides,
  });

  if (!isRecord(input)) {
    errors.push({ path: "", message: "The deck spec must be a JSON object with a slides array." });
    return { presentation: presentation(), errors, warnings };
  }
  if (spec.version !== undefined && spec.version !== 1) {
    errors.push({ path: "version", message: "Only version 1 is supported." });
  }
  const readTheme = (value: unknown, path: string): ThemeId | undefined => {
    if (value === undefined || value === null) return undefined;
    if (isThemeId(value)) return value;
    errors.push({ path, message: `Unknown theme. Use one of: ${THEME_IDS.join(", ")}.` });
    return undefined;
  };
  const deckTheme = readTheme(spec.theme, "theme");
  const footer = isRecord(spec.footer)
    ? {
      left: typeof spec.footer.left === "string" ? spec.footer.left : undefined,
      note: typeof spec.footer.note === "string" ? spec.footer.note : undefined,
    }
    : undefined;

  if (!Array.isArray(spec.slides) || spec.slides.length === 0) {
    errors.push({ path: "slides", message: "Add at least one slide." });
    return { presentation: presentation(), errors, warnings };
  }
  if (spec.slides.length > MAX_DECK_SLIDES) {
    errors.push({ path: "slides", message: `A deck holds up to ${MAX_DECK_SLIDES} slides.` });
    return { presentation: presentation(), errors, warnings };
  }

  spec.slides.forEach((raw, index) => {
    const path = `slides[${index}]`;
    if (!isRecord(raw) || typeof raw.layout !== "string") {
      errors.push({ path, message: "Each slide needs a layout id and a content object." });
      return;
    }
    if (raw.content !== undefined && !isRecord(raw.content)) {
      errors.push({ path: `${path}.content`, message: "Use an object for content." });
      return;
    }
    const slide = buildSlide(raw.layout, raw.content ?? {}, path, footer, context);
    if (!slide) return;
    const theme = readTheme(raw.theme, `${path}.theme`) ?? deckTheme;
    slides.push(theme ? applyThemeToSlide(slide, theme) : slide);
  });

  return { presentation: presentation(), errors, warnings };
}
