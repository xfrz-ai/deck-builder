import { createUniqueId } from "@/lib/id";
import { createTableElements } from "@/lib/table/table-elements";
import { createDefaultTable } from "@/lib/table/table-model";
import type { Presentation, Slide, SlideElement, TextElement } from "@/types/presentation";
import type { TableVariant } from "@/types/table";

function belongsToTable(element: SlideElement, variant: TableVariant) {
  if (element.role === "background") return false;
  if (variant === "packages") {
    // The highlight star, by its legacy or current 3D asset path.
    if (element.type === "image") return /\/(3d-stars|stars-[a-z]+)\.png$/.test(element.src) && element.width === 184;
    return element.y >= 314 && element.y < 980;
  }
  if (element.type === "image") return false;
  return element.y >= (variant === "scope" ? 352 : 355) && element.y < 980 && element.x >= (variant === "scope" ? 60 : 400);
}

export function attachDynamicTable(slide: Slide, variant: TableVariant, tableId = createUniqueId("component")): Slide {
  if (slide.table) return slide;
  const table = createDefaultTable(variant, tableId);
  const texts = slide.elements.filter((element): element is TextElement => element.type === "text" && belongsToTable(element, variant));
  const near = (x: number, y: number) => texts.find((element) => Math.abs(element.x - x) < 3 && Math.abs(element.y - y) < 3)?.text ?? "";
  const xs = variant === "packages" ? [60, 744, 1124, 1504] : variant === "scope" ? [100, 500, 800, 1100, 1400] : [437, 560, 934, 1308, 1683];
  table.columns.forEach((column, index) => {
    column.title = near(xs[index], variant === "packages" ? index ? 384 : 396 : variant === "scope" ? 392 : 380);
    if (variant === "packages" && index) column.subtitle = near(xs[index], 434);
  });
  table.rows.forEach((row, rowIndex) => table.columns.forEach((column, colIndex) => {
    const cell = row.cells[column.id];
    if (variant !== "triage") {
      const top = (variant === "packages" ? 480 : 444) + rowIndex * (variant === "packages" ? 72 : 88);
      const width = variant === "packages" ? colIndex ? 356 : 660 : colIndex ? 276 : 376;
      const candidates = texts.filter((element) => element.x >= xs[colIndex] - 1 && element.x < xs[colIndex] + width && element.y >= top - 1 && element.y < top + (variant === "packages" ? 72 : 88) - 1);
      cell.value = candidates[0]?.text ?? "";
    } else {
      const center = [478, 617, 795][rowIndex];
      const y = Math.round(center - (colIndex === 1 ? 17 : 15) * 1.5 / 2);
      cell.value = colIndex === 3 ? near(xs[colIndex], Math.round(center + 18 - 15 * 1.5 / 2))
        : colIndex === 4 ? near(xs[colIndex], Math.round(center + 5 - 33 / 2)) : near(xs[colIndex], y);
      if (colIndex === 1) cell.detail = near(xs[colIndex], Math.round(center + 29 - 15 * 1.5 / 2));
      if (colIndex === 3) cell.secondary = near(xs[colIndex], Math.round(center + 62 - 15 * 1.5 / 2));
    }
  }));
  if (variant === "packages") table.badge = texts.find((element) => element.y === 314)?.text ?? table.badge;
  if (variant === "triage") table.groups.forEach((group, index) => {
    const original = near(455, [428, 746][index]);
    if (original) group.label = original.replace(/\s*·\s*\d+\s*$/, "");
  });
  const graphic = createTableElements(table, Boolean(slide.darkMode));
  let inserted = false;
  const elements = slide.elements.flatMap<SlideElement>((element) => {
    if (!belongsToTable(element, variant)) return [{ ...element, locked: element.locked || element.type === "image" }];
    if (inserted) return [];
    inserted = true;
    return graphic;
  });
  if (!inserted) elements.push(...graphic);
  return { ...slide, table, elements };
}

function inferVariant(slide: Slide): TableVariant | undefined {
  if (slide.table) return undefined;
  const card = slide.elements.find((element) => element.type === "shape" && element.shapeType === "roundedRectangle" && element.cornerRadius === 32 &&
    ((element.x === 60 && element.y === 352 && element.width === 1800) || (element.x === 400 && element.y === 355 && element.width === 1460)));
  if (card) return card.x === 60 ? "scope" : "triage";
  if (slide.elements.some((element) => element.type === "shape" && element.x === 60 && element.y === 480 && element.width === 1800 && element.height === 1.5) &&
    slide.elements.some((element) => element.type === "text" && element.x === 744 && element.y === 384)) return "packages";
  return undefined;
}

export function normalizeTablePresentation(presentation: Presentation): Presentation {
  let changed = false;
  const slides = presentation.slides.map((slide) => {
    const variant = inferVariant(slide);
    if (!variant) return slide;
    changed = true;
    return attachDynamicTable(slide, variant);
  });
  return changed ? { ...presentation, slides } : presentation;
}
