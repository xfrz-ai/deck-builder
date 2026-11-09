import { createLayoutShape, createRotatedLayoutObject, WKND_COLORS } from "@/lib/layouts/layout-elements";
import { createLayoutText, type LayoutTextOptions } from "@/lib/layouts/layout-text";
import { componentTextFits, estimateComponentText } from "@/lib/text/component-text";
import type { Slide, SlideElement, TextElement } from "@/types/presentation";
import type { TableCellRef, TableData } from "@/types/table";

function cellId(table: TableData, ref: TableCellRef) {
  return `${table.id}-${ref.rowId ?? ref.groupId ?? "header"}-${ref.columnId}-${ref.field}`;
}

function text(table: TableData, ref: TableCellRef, options: Omit<LayoutTextOptions, "id">, minSize = 12): TextElement {
  const element = { ...createLayoutText({ id: cellId(table, ref), ...options }), tableId: table.id, tableCell: ref, locked: true };
  while (element.fontSize > minSize && !componentTextFits(element, estimateComponentText)) element.fontSize--;
  return element;
}

function shape(id: string, x: number, y: number, width: number, height: number, fill: string, radius = 0) {
  return createLayoutShape({ id, x, y, width, height, fill, shapeType: radius ? "roundedRectangle" : "rectangle", cornerRadius: radius });
}

function columnBoxes(table: TableData, x: number, width: number) {
  const columns = table.columns.slice(0, table.columnCount);
  const available = width - (columns.length - 1) * 24;
  const first = table.variant === "packages" ? Math.min(660, available * (columns.length <= 3 ? 0.42 : 0.4)) : 376;
  const weights = columns.map((column, index) => table.variant !== "triage" ? index === 0 ? first : (available - first) / (columns.length - 1)
    : column.kind === "issue" || column.kind === "steps" || column.kind === "expected" ? 2.5 : column.kind === "status" ? 1 : 0.8);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let left = x;
  return columns.map((column, index) => {
    const box = { column, x: left, width: available * weights[index] / total };
    left += box.width + 24;
    return box;
  });
}

function ordinaryTable(table: TableData, darkMode: boolean): SlideElement[] {
  const packages = table.variant === "packages";
  const boxes = columnBoxes(table, packages ? 60 : 100, packages ? 1800 : 1720);
  const rows = table.rows.slice(0, table.rowCount);
  const rowTop = packages ? 480 : 444;
  const pitch = Math.min(packages ? 72 : 88, 480 / rows.length);
  const bottom = rowTop + pitch * rows.length;
  const elements: SlideElement[] = [];
  const ink = packages && darkMode ? WKND_COLORS.white : WKND_COLORS.black;
  const muted = packages && darkMode ? "#BBBBBB" : WKND_COLORS.muted;
  if (!packages) elements.push(shape(`${table.id}-card`, 60, 352, 1800, bottom + 20 - 352, WKND_COLORS.cream, 32));
  for (let row = 0; row <= rows.length; row++) elements.push(shape(`${table.id}-rule-${row}`, packages ? 60 : 100, rowTop + row * pitch, packages ? 1800 : 1720, 1.5, packages && darkMode ? "#555555" : "#E4DFCF"));
  const highlighted = packages ? boxes.find((box, index) => index > 0 && box.column.id === table.highlightedColumnId) : undefined;
  if (highlighted) {
    const badgeWidth = Math.min(196, highlighted.width - 20);
    elements.push(
      shape(`${table.id}-highlight`, highlighted.x, 336, highlighted.width, bottom + 20 - 336, WKND_COLORS.blue, 24),
      shape(`${table.id}-badge`, highlighted.x + (highlighted.width - badgeWidth) / 2, 314, badgeWidth, 44, WKND_COLORS.yellow, 22),
      text(table, { columnId: highlighted.column.id, field: "badge" }, { text: table.badge, x: highlighted.x + (highlighted.width - badgeWidth) / 2, y: 314, width: badgeWidth, height: 44, fontSize: 22, align: "center", verticalAlign: "middle" }),
    );
  }
  boxes.forEach(({ column, x, width }, index) => {
    const selected = highlighted?.column.id === column.id;
    const color = selected ? WKND_COLORS.white : ink;
    elements.push(text(table, { columnId: column.id, field: "title" }, {
      text: column.title, x, y: packages ? index ? 384 : 396 : 392, width, height: packages && index ? 46 : 40,
      fontSize: packages ? index ? 38 : 24 : 20, fontWeight: packages && index ? 600 : 400,
      align: packages && index ? "center" : "left", verticalAlign: "middle", color: packages && index ? color : muted,
    }, 14));
    if (packages && index) elements.push(text(table, { columnId: column.id, field: "subtitle" }, {
      text: column.subtitle, x, y: 434, width, height: 28, fontSize: 22,
      align: "center", color: selected ? WKND_COLORS.white : muted, opacity: selected ? 0.8 : 1,
    }, 14));
    rows.forEach((row, rowIndex) => {
      const cell = row.cells[column.id];
      const ref: TableCellRef = { rowId: row.id, columnId: column.id, field: "value" };
      const top = rowTop + rowIndex * pitch;
      // The full cell remains a double-click target even for an empty cell or a narrow badge.
      elements.push({ ...shape(`${cellId(table, ref)}-hit`, x, top, width, pitch, "transparent"), tableCell: ref });
      if (column.kind === "comparison" && cell.value === "✓") {
        const size = Math.min(30, pitch - 12);
        elements.push(createLayoutShape({ id: `${cellId(table, ref)}-check`, shapeType: "circle", x: x + (width - size) / 2, y: top + (pitch - size) / 2, width: size, height: size, fill: "transparent", stroke: color, strokeWidth: 2 }));
        elements.push(text(table, ref, { text: "✓", x, y: top, width, height: pitch, fontSize: 17, fontWeight: 700, align: "center", verticalAlign: "middle", color }));
      } else if (column.kind === "role" && ["Lead", "Support"].includes(cell.value)) {
        const lead = cell.value === "Lead";
        const badgeWidth = Math.min(lead ? 88 : 124, width);
        const badgeHeight = Math.min(42, pitch - 12);
        const y = top + (pitch - badgeHeight) / 2;
        elements.push({ ...shape(`${cellId(table, ref)}-badge`, x, y, badgeWidth, badgeHeight, lead ? WKND_COLORS.blue : "transparent", badgeHeight / 2), stroke: WKND_COLORS.blue, strokeWidth: 2 });
        elements.push(text(table, ref, { text: cell.value, x, y, width: badgeWidth, height: badgeHeight, fontSize: 22, align: "center", verticalAlign: "middle", color: lead ? WKND_COLORS.white : WKND_COLORS.blue }, 14));
      } else elements.push(text(table, ref, {
        text: cell.value, x, y: top, width, height: pitch, fontSize: index ? packages ? 24 : 22 : 26,
        fontWeight: !packages && index === 0 ? 600 : 400, align: packages && index ? "center" : "left",
        verticalAlign: "middle", color: index === 0 ? ink : color,
      }, 14));
    });
  });
  if (highlighted) elements.push(createRotatedLayoutObject({ id: `${table.id}-star`, file: "3d-stars.png", size: 184, center: { x: highlighted.x + highlighted.width - 12, y: 252 }, rotation: 15 }));
  return elements;
}

function triageTable(table: TableData): SlideElement[] {
  const boxes = columnBoxes(table, 437, 1387);
  const rows = table.rows.slice(0, table.rowCount);
  const groups = table.groups.filter((group) => rows.some((row) => row.groupId === group.id));
  const pitch = Math.min(140, (453 - groups.length * 36) / rows.length);
  const elements: SlideElement[] = [shape(`${table.id}-card`, 400, 355, 1460, 542, WKND_COLORS.cream, 32)];
  const rule = (id: string, y: number) => ({ ...shape(id, 437, y, 1387, 1, WKND_COLORS.black), opacity: 0.15 });
  boxes.forEach(({ column, x, width }) => elements.push(text(table, { columnId: column.id, field: "title" }, {
    text: column.title, x, y: 378, width, height: 28, fontSize: 14, color: WKND_COLORS.muted, verticalAlign: "middle",
  })));
  elements.push(rule(`${table.id}-header-rule`, 411));
  let top = 424;
  let previousGroup: string | undefined;
  rows.forEach((row, rowIndex) => {
    const group = table.groups.find((group) => group.id === row.groupId);
    if (group && previousGroup !== group.id) {
      const count = rows.filter((item) => item.groupId === group.id).length;
      elements.push(
        createLayoutShape({ id: `${table.id}-${group.id}-dot`, shapeType: "circle", x: 437, y: top + 10, width: 10, height: 10, fill: group.color }),
        text(table, { columnId: boxes[0].column.id, groupId: group.id, field: "group" }, { text: `${group.label} · ${count}`, x: 455, y: top + 2, width: 300, height: 26, fontSize: 15, fontWeight: 600 }),
      );
      top += 36;
    }
    previousGroup = group?.id;
    const y = top;
    boxes.forEach(({ column, x, width }) => {
      const cell = row.cells[column.id];
      const ref: TableCellRef = { rowId: row.id, columnId: column.id, field: "value" };
      elements.push({ ...shape(`${cellId(table, ref)}-hit`, x, y, width, pitch, "transparent"), tableCell: ref });
      if (column.kind === "status" && ["Open", "In progress", "Fixed"].includes(cell.value)) {
        const fixed = cell.value === "Fixed";
        const color = fixed ? WKND_COLORS.white : cell.value === "Open" ? WKND_COLORS.orange : WKND_COLORS.blue;
        const badgeWidth = Math.min(width, cell.value === "In progress" ? 104 : 68);
        elements.push({ ...shape(`${cellId(table, ref)}-badge`, x, y + 8, badgeWidth, 33, fixed ? WKND_COLORS.black : "transparent", 16.5), stroke: fixed ? WKND_COLORS.black : color, strokeWidth: 1.5 });
        elements.push(text(table, ref, { text: cell.value, x, y: y + 8, width: badgeWidth, height: 33, fontSize: 14, align: "center", verticalAlign: "middle", color }));
      } else if (column.kind === "issue") {
        elements.push(
          text(table, ref, { text: cell.value, x, y: y + 6, width, height: Math.min(40, pitch * 0.4), fontSize: 17, fontWeight: 600, lineHeight: 1.4 }, 11),
          text(table, { ...ref, field: "detail" }, { text: cell.detail, x, y: y + Math.min(44, pitch * 0.45), width, height: Math.max(20, pitch - Math.min(44, pitch * 0.45) - 10), fontSize: 15, color: WKND_COLORS.muted, lineHeight: 1.5 }, 10),
        );
      } else if (column.kind === "expected") {
        const half = (pitch - 12) / 2;
        elements.push(
          createLayoutText({ id: `${cellId(table, ref)}-expected-label`, text: "Expected", x, y: y + 2, width, height: 18, fontSize: 13, fontWeight: 600, color: WKND_COLORS.blue }),
          text(table, ref, { text: cell.value, x, y: y + 20, width, height: Math.max(18, half - 20), fontSize: 15, lineHeight: 1.4 }, 10),
          createLayoutText({ id: `${cellId(table, ref)}-actual-label`, text: "Actual", x, y: y + half + 2, width, height: 18, fontSize: 13, fontWeight: 600, color: WKND_COLORS.orange }),
          text(table, { ...ref, field: "secondary" }, { text: cell.secondary, x, y: y + half + 20, width, height: Math.max(18, half - 20), fontSize: 15, lineHeight: 1.4 }, 10),
        );
      } else elements.push(text(table, ref, { text: cell.value, x, y: y + 6, width, height: pitch - 14, fontSize: 15, color: column === boxes[0].column ? WKND_COLORS.muted : WKND_COLORS.black, lineHeight: 1.5 }, 10));
    });
    top += pitch;
    if (rowIndex < rows.length - 1) elements.push(rule(`${table.id}-${row.id}-rule`, top - 3));
  });
  return elements;
}

export function createTableElements(table: TableData, darkMode = false): SlideElement[] {
  return (table.variant === "triage" ? triageTable(table) : ordinaryTable(table, darkMode))
    .map((element) => ({ ...element, tableId: table.id, locked: true }));
}

export function updateTableSlide(slide: Slide, table: TableData): Slide {
  const replacements = createTableElements(table, Boolean(slide.darkMode));
  let inserted = false;
  const elements = slide.elements.flatMap((element) => {
    if (element.tableId !== table.id) return [element];
    if (inserted) return [];
    inserted = true;
    return replacements;
  });
  if (!inserted) elements.push(...replacements);
  return { ...slide, table, elements };
}

export function getTableSelectionId(slide: Slide) {
  if (!slide.table) return undefined;
  return slide.elements.find((element) => element.tableId === slide.table!.id && element.visible !== false)?.id;
}

export function getTableBounds(slide: Slide) {
  const elements = slide.table ? slide.elements.filter((element) => element.tableId === slide.table!.id && element.visible !== false) : [];
  if (!elements.length) return null;
  const x = Math.min(...elements.map((element) => element.x));
  const y = Math.min(...elements.map((element) => element.y));
  return { x, y, width: Math.max(...elements.map((element) => element.x + element.width)) - x, height: Math.max(...elements.map((element) => element.y + element.height)) - y };
}

function sameCell(a: TableCellRef, b: TableCellRef) {
  return a.rowId === b.rowId && a.columnId === b.columnId && a.groupId === b.groupId && a.field === b.field;
}

export function getTableCellAtPoint(slide: Slide, point: { x: number; y: number }) {
  const hit = [...slide.elements].reverse().find((element) => element.tableId === slide.table?.id && element.tableCell && element.visible !== false &&
    point.x >= element.x && point.x <= element.x + element.width && point.y >= element.y && point.y <= element.y + element.height);
  if (!hit?.tableCell) return undefined;
  return hit.type === "text" ? hit : slide.elements.find((element): element is TextElement => element.type === "text" && element.tableId === slide.table?.id && !!element.tableCell && sameCell(element.tableCell, hit.tableCell!));
}

export function getTableCellOrder(slide: Slide) {
  const table = slide.table;
  if (!table) return [];
  const columns = table.columns.slice(0, table.columnCount);
  const refs: TableCellRef[] = columns.flatMap((col, index) => [
    { columnId: col.id, field: "title" as const },
    ...(table.variant === "packages" && index > 0 ? [{ columnId: col.id, field: "subtitle" as const }] : []),
  ]);
  if (table.highlightedColumnId) refs.push({ columnId: table.highlightedColumnId, field: "badge" });
  const seenGroups = new Set<string>();
  table.rows.slice(0, table.rowCount).forEach((row) => {
    if (row.groupId && !seenGroups.has(row.groupId)) {
      seenGroups.add(row.groupId);
      refs.push({ columnId: columns[0].id, groupId: row.groupId, field: "group" });
    }
    columns.forEach((col) => {
      refs.push({ rowId: row.id, columnId: col.id, field: "value" });
      if (col.kind === "issue") refs.push({ rowId: row.id, columnId: col.id, field: "detail" });
      if (col.kind === "expected") refs.push({ rowId: row.id, columnId: col.id, field: "secondary" });
    });
  });
  return refs.flatMap((ref) => {
    const element = slide.elements.find((element) => element.type === "text" && element.tableId === table.id && element.tableCell && sameCell(element.tableCell, ref));
    return element ? [element.id] : [];
  });
}
