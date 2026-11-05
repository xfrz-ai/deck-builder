import { createUniqueId } from "@/lib/id";
import {
  gridHeight,
  gridWidth,
  gridX,
  gridY,
  LAYOUT_GRID,
} from "@/lib/layouts/layout-grid";
import type { ImageElement } from "@/types/presentation";

const PLACEHOLDER_SRC = "/assets/card-placeholder.png";
const PLACEHOLDER_WIDTH = 1200;
const PLACEHOLDER_HEIGHT = 900;
const CORNER_RADIUS = 16;

// The full 24×12 content area, between the slide header and footer.
export const IMAGE_GRID_AREA = {
  x: gridX(1),
  y: gridY(1),
  width: gridWidth(LAYOUT_GRID.columns),
  height: gridHeight(LAYOUT_GRID.rows),
  gap: LAYOUT_GRID.gutter,
} as const;

// [column, row, columnSpan, rowSpan] on the layout's own track grid.
type GridCell = readonly [number, number, number, number];

export interface ImageGridLayout {
  cells: readonly GridCell[];
  columns: number;
  id: string;
  name: string;
  rows: number;
}

function uniformCells(columns: number, rows: number): GridCell[] {
  return Array.from({ length: columns * rows }, (_, index) => [
    index % columns,
    Math.floor(index / columns),
    1,
    1,
  ]);
}

function uniform(id: string, name: string, columns: number, rows: number) {
  return { id, name, columns, rows, cells: uniformCells(columns, rows) };
}

export const IMAGE_GRID_LAYOUTS: readonly ImageGridLayout[] = [
  uniform("single", "1 image", 1, 1),
  uniform("columns-2", "2 columns", 2, 1),
  uniform("columns-3", "3 columns", 3, 1),
  uniform("columns-4", "4 columns", 4, 1),
  uniform("rows-2", "2 rows", 1, 2),
  uniform("rows-3", "3 rows", 1, 3),
  uniform("grid-2x2", "2 × 2", 2, 2),
  uniform("grid-3x2", "3 × 2", 3, 2),
  uniform("grid-4x2", "4 × 2", 4, 2),
  {
    id: "wide-narrow",
    name: "Wide + narrow",
    columns: 3,
    rows: 1,
    cells: [
      [0, 0, 2, 1],
      [2, 0, 1, 1],
    ],
  },
  {
    id: "narrow-wide",
    name: "Narrow + wide",
    columns: 3,
    rows: 1,
    cells: [
      [0, 0, 1, 1],
      [1, 0, 2, 1],
    ],
  },
  {
    id: "big-left-2",
    name: "Big left, 2 right",
    columns: 2,
    rows: 2,
    cells: [
      [0, 0, 1, 2],
      [1, 0, 1, 1],
      [1, 1, 1, 1],
    ],
  },
  {
    id: "big-right-2",
    name: "2 left, big right",
    columns: 2,
    rows: 2,
    cells: [
      [0, 0, 1, 1],
      [0, 1, 1, 1],
      [1, 0, 1, 2],
    ],
  },
  {
    id: "wide-top-2",
    name: "Wide top, 2 below",
    columns: 2,
    rows: 2,
    cells: [
      [0, 0, 2, 1],
      [0, 1, 1, 1],
      [1, 1, 1, 1],
    ],
  },
  {
    id: "wide-bottom-2",
    name: "2 top, wide below",
    columns: 2,
    rows: 2,
    cells: [
      [0, 0, 1, 1],
      [1, 0, 1, 1],
      [0, 1, 2, 1],
    ],
  },
  {
    id: "wide-top-3",
    name: "Wide top, 3 below",
    columns: 3,
    rows: 2,
    cells: [
      [0, 0, 3, 1],
      [0, 1, 1, 1],
      [1, 1, 1, 1],
      [2, 1, 1, 1],
    ],
  },
  {
    id: "feature-left-3",
    name: "Feature left, 3 right",
    columns: 3,
    rows: 3,
    cells: [
      [0, 0, 2, 3],
      [2, 0, 1, 1],
      [2, 1, 1, 1],
      [2, 2, 1, 1],
    ],
  },
  {
    id: "big-left-grid",
    name: "Big left, 2 × 2 right",
    columns: 4,
    rows: 2,
    cells: [
      [0, 0, 2, 2],
      [2, 0, 1, 1],
      [3, 0, 1, 1],
      [2, 1, 1, 1],
      [3, 1, 1, 1],
    ],
  },
  {
    id: "big-right-grid",
    name: "2 × 2 left, big right",
    columns: 4,
    rows: 2,
    cells: [
      [0, 0, 1, 1],
      [1, 0, 1, 1],
      [0, 1, 1, 1],
      [1, 1, 1, 1],
      [2, 0, 2, 2],
    ],
  },
];

function trackStart(index: number, size: number) {
  return index * (size + IMAGE_GRID_AREA.gap);
}

function trackSpan(span: number, size: number) {
  return span * size + (span - 1) * IMAGE_GRID_AREA.gap;
}

// Cell boxes in slide coordinates.
export function getImageGridRects(layout: ImageGridLayout) {
  const { gap, height, width, x, y } = IMAGE_GRID_AREA;
  const columnWidth = (width - gap * (layout.columns - 1)) / layout.columns;
  const rowHeight = (height - gap * (layout.rows - 1)) / layout.rows;

  return layout.cells.map(([column, row, columnSpan, rowSpan]) => ({
    x: x + trackStart(column, columnWidth),
    y: y + trackStart(row, rowHeight),
    width: trackSpan(columnSpan, columnWidth),
    height: trackSpan(rowSpan, rowHeight),
  }));
}

// Replaceable placeholder images; "cover" keeps any photo undistorted.
export function createImageGridElements(
  layout: ImageGridLayout,
): ImageElement[] {
  return getImageGridRects(layout).map((rect) => ({
    id: createUniqueId("element"),
    type: "image",
    ...rect,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    src: PLACEHOLDER_SRC,
    originalWidth: PLACEHOLDER_WIDTH,
    originalHeight: PLACEHOLDER_HEIGHT,
    cornerRadius: CORNER_RADIUS,
    fit: "cover",
  }));
}
