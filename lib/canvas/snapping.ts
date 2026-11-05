import { gridX, gridY, LAYOUT_GRID } from "@/lib/layouts/layout-grid";
import { PRESENTATION_HEIGHT, PRESENTATION_WIDTH } from "@/types/presentation";

// Distance in screen pixels within which an edge or centre locks to a guide;
// divide by the canvas scale to get logical pixels.
export const SNAP_THRESHOLD_PX = 6;

export interface SnapGuides {
  // x positions of vertical lines.
  vertical: readonly number[];
  // y positions of horizontal lines.
  horizontal: readonly number[];
}

export interface SnapRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface SnapLines {
  horizontal: number[];
  vertical: number[];
}

// Column and row edges of the 24×12 brand grid, plus the slide centre.
export function getLayoutGuides(): SnapGuides {
  const columnEdges = Array.from(
    { length: LAYOUT_GRID.columns },
    (_, index) => [
      gridX(index + 1),
      gridX(index + 1) + LAYOUT_GRID.columnWidth,
    ],
  ).flat();
  const rowEdges = Array.from({ length: LAYOUT_GRID.rows }, (_, index) => [
    gridY(index + 1),
    gridY(index + 1) + LAYOUT_GRID.rowHeight,
  ]).flat();

  return {
    vertical: [...columnEdges, PRESENTATION_WIDTH / 2],
    horizontal: [...rowEdges, PRESENTATION_HEIGHT / 2],
  };
}

// Edges and centres of other elements, for aligning elements to each other.
export function getElementGuides(rects: readonly SnapRect[]): SnapGuides {
  return {
    vertical: rects.flatMap((rect) => [
      rect.x,
      rect.x + rect.width / 2,
      rect.x + rect.width,
    ]),
    horizontal: rects.flatMap((rect) => [
      rect.y,
      rect.y + rect.height / 2,
      rect.y + rect.height,
    ]),
  };
}

export function mergeGuides(...guides: readonly SnapGuides[]): SnapGuides {
  return {
    vertical: guides.flatMap((guide) => guide.vertical),
    horizontal: guides.flatMap((guide) => guide.horizontal),
  };
}

// Smallest box containing every rect; null for an empty list.
export function unionRects(rects: readonly SnapRect[]): SnapRect | null {
  if (rects.length === 0) {
    return null;
  }

  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));

  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function hasSnapLines(lines: SnapLines) {
  return lines.vertical.length > 0 || lines.horizontal.length > 0;
}

// Nearest guide to any candidate within the threshold; the returned lines are
// every guide the candidates touch once the correction is applied.
function snapAxis(
  candidates: readonly number[],
  guides: readonly number[],
  threshold: number,
) {
  let delta: number | null = null;

  for (const candidate of candidates) {
    for (const guide of guides) {
      const distance = guide - candidate;

      if (
        Math.abs(distance) <= threshold &&
        (delta === null || Math.abs(distance) < Math.abs(delta))
      ) {
        delta = distance;
      }
    }
  }

  if (delta === null) {
    return { delta: 0, lines: [] };
  }

  const snapped = candidates.map((candidate) => candidate + (delta ?? 0));
  const lines = [
    ...new Set(
      guides.filter((guide) =>
        snapped.some((value) => Math.abs(value - guide) < 0.5),
      ),
    ),
  ];

  return { delta, lines };
}

// Snaps a moving box by its start, centre and end, each axis on its own.
export function snapBox(box: SnapRect, guides: SnapGuides, threshold: number) {
  const x = snapAxis(
    [box.x, box.x + box.width / 2, box.x + box.width],
    guides.vertical,
    threshold,
  );
  const y = snapAxis(
    [box.y, box.y + box.height / 2, box.y + box.height],
    guides.horizontal,
    threshold,
  );

  return {
    dx: x.delta,
    dy: y.delta,
    lines: { vertical: x.lines, horizontal: y.lines },
  };
}

// Snaps one point, e.g. a resize handle, on the axes it controls.
export function snapPoint(
  point: { x: number; y: number },
  guides: SnapGuides,
  threshold: number,
  axes: { x: boolean; y: boolean },
) {
  const x = axes.x
    ? snapAxis([point.x], guides.vertical, threshold)
    : { delta: 0, lines: [] };
  const y = axes.y
    ? snapAxis([point.y], guides.horizontal, threshold)
    : { delta: 0, lines: [] };

  return {
    point: { x: point.x + x.delta, y: point.y + y.delta },
    lines: { vertical: x.lines, horizontal: y.lines },
  };
}
