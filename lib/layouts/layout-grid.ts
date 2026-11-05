// 24-column × 12-row grid on the 1920×1080 canvas. 24 splits evenly into
// both thirds and eighths.
//   Horizontal: 60 + 24×52 + 23×24 + 60 = 1920 (content 60–1860)
//   Vertical:  120 + 12×48 + 11×24 + 120 = 1080 (content 120–960)
// The locked header/footer frame sits at 40px, so content is inset 20px from
// it; rows stay at 48 so the content keeps clear of the logo and footer.
export const LAYOUT_GRID = {
  columns: 24,
  rows: 12,
  marginX: 60,
  marginY: 120,
  gutter: 24,
  columnWidth: 52,
  rowHeight: 48,
} as const;

// x of the 1-based column's left edge.
export function gridX(column: number) {
  return (
    LAYOUT_GRID.marginX +
    (column - 1) * (LAYOUT_GRID.columnWidth + LAYOUT_GRID.gutter)
  );
}

// Width covered by `span` columns, including the gutters between them.
export function gridWidth(span: number) {
  return span * LAYOUT_GRID.columnWidth + (span - 1) * LAYOUT_GRID.gutter;
}

// y of the 1-based row's top edge.
export function gridY(row: number) {
  return (
    LAYOUT_GRID.marginY +
    (row - 1) * (LAYOUT_GRID.rowHeight + LAYOUT_GRID.gutter)
  );
}

// Height covered by `span` rows, including the gutters between them.
export function gridHeight(span: number) {
  return span * LAYOUT_GRID.rowHeight + (span - 1) * LAYOUT_GRID.gutter;
}
