"use client";

import { Pencil, Table2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { generatorInputClassName } from "@/components/editor/generator-dialog";
import { getTableCellOrder } from "@/lib/table/table-elements";
import { getTableRowLimit, MAX_TABLE_COLUMNS, TABLE_NAMES } from "@/lib/table/table-model";
import { componentTextFits, estimateComponentText } from "@/lib/text/component-text";
import { useEditorStore } from "@/store/editor-store";
import type { Slide } from "@/types/presentation";

export function TableProperties({ slide }: { slide: Slide }) {
  const table = slide.table!;
  const resize = useEditorStore((state) => state.resizeSlideTable);
  const setHighlight = useEditorStore((state) => state.setTableHighlight);
  const startTextEditing = useEditorStore((state) => state.startTextEditing);
  const [rows, setRows] = useState(String(table.rowCount));
  const [columns, setColumns] = useState(String(table.columnCount));
  useEffect(() => { setRows(String(table.rowCount)); setColumns(String(table.columnCount)); }, [table.id, table.rowCount, table.columnCount]);
  const rowCount = Number(rows);
  const columnCount = Number(columns);
  const valid = Number.isInteger(rowCount) && rowCount >= 1 && rowCount <= getTableRowLimit(table.variant) && Number.isInteger(columnCount) && columnCount >= 2 && columnCount <= MAX_TABLE_COLUMNS;
  const changed = rowCount !== table.rowCount || columnCount !== table.columnCount;
  const hasOverflow = slide.elements.some((element) => element.type === "text" && element.tableId === table.id && element.tableCell && !componentTextFits(element, estimateComponentText));
  return (
    <section className="editor-scrollbar space-y-4 overflow-y-auto border-b border-stroke-01 p-4" aria-label="Table properties">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary"><Table2 className="size-4" />Table · {TABLE_NAMES[table.variant]}</div>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5 text-[11px] text-muted-foreground">
          <span className="block">Rows</span>
          <input aria-label="Table rows" className={generatorInputClassName} id="table-rows" type="number" min={1} max={getTableRowLimit(table.variant)} value={rows} onChange={(event) => setRows(event.target.value)} />
        </label>
        <label className="space-y-1.5 text-[11px] text-muted-foreground">
          <span className="block">Columns</span>
          <input aria-label="Table columns" className={generatorInputClassName} type="number" min={2} max={MAX_TABLE_COLUMNS} value={columns} onChange={(event) => setColumns(event.target.value)} />
        </label>
      </div>
      <p className="text-[11px] leading-4 text-muted-foreground">Rows exclude the header. This template fits up to {getTableRowLimit(table.variant)} rows and {MAX_TABLE_COLUMNS} columns.</p>
      <Button className="w-full" disabled={!valid || !changed} onClick={() => resize(slide.id, rowCount, columnCount)} variant="outline">Apply structure</Button>
      {!valid ? <p role="alert" className="text-[11px] text-destructive">Use 1–{getTableRowLimit(table.variant)} rows and 2–{MAX_TABLE_COLUMNS} columns.</p> : null}
      <p className="text-[11px] leading-4 text-muted-foreground">Existing content is kept when you reduce the dimensions. Increase them again to restore hidden cells.</p>
      {table.variant === "packages" ? (
        <label className="block space-y-1.5 text-[11px] text-muted-foreground">
          <span className="block">Highlighted column</span>
          <select className={generatorInputClassName} value={table.columns.slice(1, table.columnCount).some((column) => column.id === table.highlightedColumnId) ? table.highlightedColumnId : ""} onChange={(event) => setHighlight(slide.id, event.target.value || undefined)}>
            <option value="">None</option>
            {table.columns.slice(1, table.columnCount).map((column, index) => <option key={column.id} value={column.id}>{column.title || `Column ${index + 2}`}</option>)}
          </select>
        </label>
      ) : null}
      <Button className="w-full" variant="outline" onClick={() => { const id = getTableCellOrder(slide)[0]; if (id) startTextEditing(id); }}><Pencil className="size-3.5" />Edit cells</Button>
      <p className="text-[11px] leading-4 text-muted-foreground">Double-click a cell to edit. Tab moves forward; Shift+Tab moves back. Type ✓ or — for comparison cells. Edit slide titles directly on the canvas.</p>
      {hasOverflow ? <p role="status" className="text-[11px] leading-4 text-destructive">Some cell text exceeds the available space. Shorten it or use fewer rows or columns. The full text stays saved.</p> : null}
    </section>
  );
}
