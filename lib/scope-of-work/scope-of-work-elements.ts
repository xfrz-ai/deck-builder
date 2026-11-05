import { LAYOUT_GRID, gridWidth, gridX } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { ShapeElement, SlideElement } from "@/types/presentation";

export interface ScopeOfWorkSection {
  title: string;
  items: readonly string[];
}

// Measures a single-line label in logical pixels.
export type MeasureScopeLabel = (label: string, fontSize: number) => number;

export interface ScopeOfWorkColors {
  // Number, title and divider color. Black follows the slide's dark mode.
  text: string;
  // Circle outline and dividers are plain shapes, so dark mode can't swap them.
  line: string;
}

// Three cards fill the 24-column grid: columns 1, 10 and 19, six columns
// each, with a three-column gap between them.
export const MAX_SCOPE_SECTIONS = 3;
export const SCOPE_PILL_FONT_SIZE = 20;
const SECTION_COLUMNS = [1, 10, 19] as const;
const SECTION_WIDTH = gridWidth(6);
const SECTION_TOP = 270;
const SECTION_BOTTOM = 944;
const NUMBER_SIZE = 80;
const SECTION_TITLE_Y = 392;
const PILL_TOP = 528;
const PILL_HEIGHT = 56;
const PILL_GAP = 16;
const PILL_PADDING = 32;
const PILL_ROW_STEP = PILL_HEIGHT + PILL_GAP;
const MAX_PILL_ROWS = Math.floor(
  (SECTION_BOTTOM - PILL_TOP + PILL_GAP) / PILL_ROW_STEP,
);
const PILL_COLOR = "#111111";
const PILL_TEXT_COLOR = "#FFFFFF";
const DEFAULT_COLORS: ScopeOfWorkColors = {
  text: "#111111",
  line: "#111111",
};
// Rough average glyph width of Plus Jakarta Sans relative to font size.
const AVERAGE_GLYPH_WIDTH = 0.52;

export const estimateScopeLabelWidth: MeasureScopeLabel = (label, fontSize) =>
  label.length * fontSize * AVERAGE_GLYPH_WIDTH;

interface ScopePillPlacement {
  label: string;
  x: number;
  width: number;
}

function getItems(section: ScopeOfWorkSection) {
  return section.items.map((item) => item.trim()).filter(Boolean);
}

// Pills flow left to right and wrap when the card's two columns are full.
export function layoutScopePills(
  items: readonly string[],
  measureLabel: MeasureScopeLabel,
): ScopePillPlacement[][] {
  const rows: ScopePillPlacement[][] = [];
  let row: ScopePillPlacement[] = [];
  let x = 0;

  for (const label of items) {
    const width = Math.min(
      SECTION_WIDTH,
      Math.ceil(measureLabel(label, SCOPE_PILL_FONT_SIZE)) + PILL_PADDING * 2,
    );

    if (row.length > 0 && x + width > SECTION_WIDTH) {
      rows.push(row);
      row = [];
      x = 0;
    }

    row.push({ label, x, width });
    x += width + PILL_GAP;
  }

  if (row.length > 0) {
    rows.push(row);
  }

  return rows;
}

export function getScopeSectionError(
  section: ScopeOfWorkSection,
  measureLabel: MeasureScopeLabel = estimateScopeLabelWidth,
) {
  if (!section.title.trim()) {
    return "Add a card title.";
  }

  if (
    layoutScopePills(getItems(section), measureLabel).length > MAX_PILL_ROWS
  ) {
    return `Too many items. A card fits ${MAX_PILL_ROWS} rows.`;
  }

  return null;
}

function createShape(
  id: string,
  shapeType: ShapeElement["shapeType"],
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke = fill,
  strokeWidth = 0,
): ShapeElement {
  return {
    id,
    type: "shape",
    shapeType,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    fill,
    stroke,
    strokeWidth,
  };
}

function createSectionElements(
  section: ScopeOfWorkSection,
  index: number,
  idPrefix: string,
  measureLabel: MeasureScopeLabel,
  colors: ScopeOfWorkColors,
): SlideElement[] {
  const sectionNumber = String(index + 1).padStart(2, "0");
  const prefix = `${idPrefix}-section-${sectionNumber}`;
  const x = gridX(SECTION_COLUMNS[index]);
  const rows = layoutScopePills(getItems(section), measureLabel).slice(
    0,
    MAX_PILL_ROWS,
  );

  return [
    createShape(
      `${prefix}-number-circle`,
      "circle",
      x,
      SECTION_TOP,
      NUMBER_SIZE,
      NUMBER_SIZE,
      "transparent",
      colors.line,
      2,
    ),
    createLayoutText({
      id: `${prefix}-number`,
      text: sectionNumber,
      x,
      y: SECTION_TOP,
      width: NUMBER_SIZE,
      height: NUMBER_SIZE,
      fontSize: 36,
      align: "center",
      verticalAlign: "middle",
      color: colors.text,
    }),
    createLayoutText({
      id: `${prefix}-title`,
      text: section.title.trim(),
      x,
      y: SECTION_TITLE_Y,
      width: SECTION_WIDTH,
      height: 48,
      fontSize: 40,
      color: colors.text,
    }),
    ...rows.flatMap((row, rowIndex) => {
      const y = PILL_TOP + rowIndex * PILL_ROW_STEP;

      return row.flatMap((pill, pillIndex) => {
        const id = `${prefix}-pill-${rowIndex + 1}-${pillIndex + 1}`;

        return [
          createShape(
            id,
            "rectangle",
            x + pill.x,
            y,
            pill.width,
            PILL_HEIGHT,
            PILL_COLOR,
          ),
          createLayoutText({
            id: `${id}-label`,
            text: pill.label,
            x: x + pill.x + PILL_PADDING,
            y,
            width: pill.width - PILL_PADDING * 2,
            height: PILL_HEIGHT,
            fontSize: SCOPE_PILL_FONT_SIZE,
            align: "center",
            verticalAlign: "middle",
            color: PILL_TEXT_COLOR,
          }),
        ];
      });
    }),
  ];
}

export function createScopeOfWorkElements(
  sections: readonly ScopeOfWorkSection[],
  idPrefix: string,
  {
    colors = DEFAULT_COLORS,
    measureLabel = estimateScopeLabelWidth,
  }: {
    colors?: ScopeOfWorkColors;
    measureLabel?: MeasureScopeLabel;
  } = {},
): SlideElement[] {
  const visibleSections = sections.slice(0, MAX_SCOPE_SECTIONS);

  return [
    // Dividers sit mid-column between neighbouring cards (columns 3 and 6).
    ...visibleSections
      .slice(1)
      .map((_, index) =>
        createShape(
          `${idPrefix}-divider-${index + 1}`,
          "rectangle",
          // Centre of the middle gap column.
          gridX(SECTION_COLUMNS[index] + 7) + LAYOUT_GRID.columnWidth / 2 - 1,
          SECTION_TOP,
          2,
          SECTION_BOTTOM - SECTION_TOP,
          colors.line,
        ),
      ),
    ...visibleSections.flatMap((section, index) =>
      createSectionElements(section, index, idPrefix, measureLabel, colors),
    ),
  ];
}
