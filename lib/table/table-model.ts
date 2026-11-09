import { createUniqueId } from "@/lib/id";
import type { TableCell, TableCellRef, TableColumnKind, TableData, TableVariant } from "@/types/table";

export const TABLE_NAMES = { packages: "Packages", scope: "Scope of Work", triage: "Bug Triage" } as const;
export const MAX_TABLE_COLUMNS = 6;
export function getTableRowLimit(variant: TableVariant) { return variant === "triage" ? 6 : 8; }
export function emptyTableCell(value = ""): TableCell { return { value, detail: "", secondary: "" }; }

export function createDefaultTable(variant: TableVariant, id = createUniqueId("component")): TableData {
  const headers: [string, string, TableColumnKind][] = variant === "packages" ? [
    ["What's included", "", "text"], ["Starter", "from $25k", "comparison"],
    ["Growth", "from $45k", "comparison"], ["Premium", "from $80k", "comparison"],
  ] : variant === "scope" ? [
    ["Service", "", "text"], ["01 Discover", "", "role"], ["02 Define", "", "role"],
    ["03 Design", "", "role"], ["04 Deliver", "", "role"],
  ] : [
    ["ID", "", "text"], ["Issue & impact", "", "issue"], ["Steps to reproduce", "", "steps"],
    ["Expected vs. actual", "", "expected"], ["Status", "", "status"],
  ];
  const columns = headers.map(([title, subtitle, kind], index) => ({ id: `${id}-column-${index}`, title, subtitle, kind }));
  const values = variant === "packages" ? [
    ["Timeline", "4 weeks", "8 weeks", "12 weeks"],
    ["Brand strategy", "—", "✓", "✓"],
    ["Visual identity & 3D assets", "✓", "✓", "✓"],
    ["Website", "Landing page", "Up to 5 pages", "Up to 15 pages"],
    ["Revisions", "2 rounds", "3 rounds", "Unlimited"],
    ["Dedicated project manager", "—", "—", "✓"],
  ] : variant === "scope" ? [
    ["Brand Strategy", "Lead", "Lead", "Support", "—"],
    ["Visual Identity", "—", "Support", "Lead", "Support"],
    ["Website", "—", "Support", "Lead", "Lead"],
    ["Social Content", "—", "—", "Lead", "Lead"],
    ["3D Assets", "—", "Support", "Lead", "Support"],
  ] : [
    ["BUG-1042", "CTA button clipped on small screens", "1. Open the app on an iPhone SE.\n2. Scroll to the bottom of Home.\n3. Try to tap “Get started”.", "The button sits fully above the home indicator.", "In progress"],
    ["BUG-1047", "Payment page freezes after OTP", "1. Pay with a credit card.\n2. Enter the OTP from the SMS.\n3. Wait on the confirmation screen.", "Redirect to “Order placed” within 5 seconds.", "Open"],
    ["BUG-1051", "Search ignores Indonesian keywords", "1. Open Search.\n2. Type “kursi” and submit.", "Chairs are listed first.", "Fixed"],
  ];
  const groups = variant === "triage" ? [
    { id: `${id}-critical`, label: "Critical", color: "#E04E2B" },
    { id: `${id}-major`, label: "Major", color: "#FBB03A" },
  ] : [];
  const descriptions = ["Users on 4.7” phones cannot tap “Get started”, which blocks sign-up.", "The bank charges the card, but no order is created.", "“kursi” returns nothing although 40 chairs are listed."];
  const actual = ["The bottom 18px is clipped and the tap target is too small.", "The spinner never stops and the order is missing in admin.", "“No results found” is shown."];
  const rows = values.map((row, index) => ({
    id: `${id}-row-${index}`,
    groupId: variant === "triage" ? groups[index === 2 ? 1 : 0].id : undefined,
    cells: Object.fromEntries(columns.map((column, col) => [column.id, {
      value: row[col], detail: variant === "triage" && col === 1 ? descriptions[index] : "",
      secondary: variant === "triage" && col === 3 ? actual[index] : "",
    }])),
  }));
  return { version: 1, id, variant, rowCount: rows.length, columnCount: columns.length, columns, rows, groups, badge: "Recommended", highlightedColumnId: variant === "packages" ? columns[2].id : undefined };
}

export function cloneTable(data: TableData, freshIds = false): TableData {
  const id = freshIds ? createUniqueId("component") : data.id;
  const columnIds = new Map(data.columns.map((column) => [column.id, freshIds ? createUniqueId("element") : column.id]));
  const groupIds = new Map(data.groups.map((group) => [group.id, freshIds ? createUniqueId("element") : group.id]));
  return {
    ...data, id,
    columns: data.columns.map((column) => ({ ...column, id: columnIds.get(column.id)! })),
    groups: data.groups.map((group) => ({ ...group, id: groupIds.get(group.id)! })),
    highlightedColumnId: data.highlightedColumnId ? columnIds.get(data.highlightedColumnId) : undefined,
    rows: data.rows.map((row) => ({
      ...row, id: freshIds ? createUniqueId("element") : row.id,
      groupId: row.groupId ? groupIds.get(row.groupId) : undefined,
      cells: Object.fromEntries(Object.entries(row.cells).map(([key, cell]) => [columnIds.get(key)!, { ...cell }])),
    })),
  };
}

export function resizeTable(data: TableData, rowCount: number, columnCount: number): TableData {
  const next = cloneTable(data);
  next.rowCount = Math.max(1, Math.min(getTableRowLimit(data.variant), Math.round(rowCount)));
  next.columnCount = Math.max(2, Math.min(MAX_TABLE_COLUMNS, Math.round(columnCount)));
  while (next.columns.length < next.columnCount) {
    const column = { id: createUniqueId("element"), title: "", subtitle: "", kind: (data.variant === "packages" ? "comparison" : data.variant === "scope" ? "role" : "text") as TableColumnKind };
    next.columns.push(column);
    next.rows.forEach((row) => { row.cells[column.id] = emptyTableCell(); });
  }
  while (next.rows.length < next.rowCount) next.rows.push({
    id: createUniqueId("element"), groupId: next.rows.at(-1)?.groupId,
    cells: Object.fromEntries(next.columns.map((column) => [column.id, emptyTableCell()])),
  });
  return next;
}

export function getTableCellText(data: TableData, ref: TableCellRef) {
  if (ref.field === "badge") return data.badge;
  if (ref.field === "group") return data.groups.find((group) => group.id === ref.groupId)?.label ?? "";
  const column = data.columns.find((column) => column.id === ref.columnId);
  if (ref.field === "title" || ref.field === "subtitle") return column?.[ref.field] ?? "";
  return data.rows.find((row) => row.id === ref.rowId)?.cells[ref.columnId]?.[ref.field] ?? "";
}

export function setTableCellText(data: TableData, ref: TableCellRef, text: string): TableData {
  const next = cloneTable(data);
  if (ref.field === "badge") next.badge = text;
  else if (ref.field === "group") {
    const group = next.groups.find((group) => group.id === ref.groupId);
    if (group) group.label = text;
  } else if (ref.field === "title" || ref.field === "subtitle") {
    const column = next.columns.find((column) => column.id === ref.columnId);
    if (column) column[ref.field] = text;
  } else {
    const cell = next.rows.find((row) => row.id === ref.rowId)?.cells[ref.columnId];
    if (cell) cell[ref.field] = text;
  }
  return next;
}

export function getTableCellChoices(data: TableData, ref: TableCellRef): string[] | null {
  if (ref.field !== "value") return null;
  const kind = data.columns.find((column) => column.id === ref.columnId)?.kind;
  const text = getTableCellText(data, ref);
  if (kind === "comparison" && ["✓", "—"].includes(text)) return ["✓", "—"];
  if (kind === "role" && ["", "Lead", "Support", "—"].includes(text)) return ["Lead", "Support", "—"];
  if (kind === "status" && ["", "Open", "In progress", "Fixed"].includes(text)) return ["Open", "In progress", "Fixed"];
  return null;
}

export function isTableCellRef(value: unknown): value is TableCellRef {
  if (!value || typeof value !== "object") return false;
  const ref = value as Record<string, unknown>;
  return typeof ref.columnId === "string" && !!ref.columnId &&
    ["value", "detail", "secondary", "title", "subtitle", "badge", "group"].includes(String(ref.field)) &&
    (ref.rowId === undefined || typeof ref.rowId === "string") &&
    (ref.groupId === undefined || typeof ref.groupId === "string");
}

export function isTableData(value: unknown): value is TableData {
  if (!value || typeof value !== "object") return false;
  const data = value as TableData;
  if (data.version !== 1 || typeof data.id !== "string" || !data.id || !["packages", "scope", "triage"].includes(data.variant) ||
    !Number.isInteger(data.rowCount) || data.rowCount < 1 || data.rowCount > getTableRowLimit(data.variant) ||
    !Number.isInteger(data.columnCount) || data.columnCount < 2 || data.columnCount > MAX_TABLE_COLUMNS ||
    !Array.isArray(data.columns) || data.columns.length < data.columnCount || data.columns.length > MAX_TABLE_COLUMNS ||
    !Array.isArray(data.rows) || data.rows.length < data.rowCount || data.rows.length > getTableRowLimit(data.variant) ||
    !Array.isArray(data.groups) || data.groups.length > 8 || typeof data.badge !== "string") return false;
  const columnIds = new Set<string>();
  if (!data.columns.every((col) => {
    if (!col || typeof col.id !== "string" || !col.id || columnIds.has(col.id) || typeof col.title !== "string" || typeof col.subtitle !== "string" ||
      !["text", "comparison", "role", "issue", "steps", "expected", "status"].includes(col.kind)) return false;
    columnIds.add(col.id); return true;
  })) return false;
  const groupIds = new Set<string>();
  if (!data.groups.every((group) => {
    if (!group || typeof group.id !== "string" || !group.id || groupIds.has(group.id) || typeof group.label !== "string" || typeof group.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(group.color)) return false;
    groupIds.add(group.id); return true;
  })) return false;
  if (data.highlightedColumnId !== undefined && !columnIds.has(data.highlightedColumnId)) return false;
  const rowIds = new Set<string>();
  return data.rows.every((row) => {
    if (!row || typeof row.id !== "string" || !row.id || rowIds.has(row.id) || (row.groupId !== undefined && !groupIds.has(row.groupId)) || !row.cells || typeof row.cells !== "object") return false;
    rowIds.add(row.id);
    return data.columns.every((col) => {
      const cell = row.cells[col.id];
      return !!cell && typeof cell.value === "string" && typeof cell.detail === "string" && typeof cell.secondary === "string";
    });
  });
}
