export type TableVariant = "packages" | "scope" | "triage";
export type TableColumnKind = "text" | "comparison" | "role" | "issue" | "steps" | "expected" | "status";
export type TableCellField = "value" | "detail" | "secondary" | "title" | "subtitle" | "badge" | "group";

export interface TableCellRef {
  columnId: string;
  rowId?: string;
  groupId?: string;
  field: TableCellField;
}

export interface TableColumn {
  id: string;
  title: string;
  subtitle: string;
  kind: TableColumnKind;
}

export interface TableCell {
  value: string;
  detail: string;
  secondary: string;
}

export interface TableRow {
  id: string;
  groupId?: string;
  cells: Record<string, TableCell>;
}

export interface TableData {
  version: 1;
  id: string;
  variant: TableVariant;
  // Hidden rows and columns retain their content when dimensions shrink.
  rowCount: number;
  columnCount: number;
  columns: TableColumn[];
  rows: TableRow[];
  groups: { id: string; label: string; color: string }[];
  highlightedColumnId?: string;
  badge: string;
}
