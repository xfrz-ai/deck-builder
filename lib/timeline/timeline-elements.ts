import { createLayoutText } from "@/lib/layouts/layout-text";
import type { ShapeElement, SlideElement } from "@/types/presentation";

export interface TimelineBar {
  label: string;
  // Positions in column units; `end` is exclusive and may be fractional.
  start: number;
  end: number;
}

export interface TimelineModel {
  columns: readonly string[];
  months: readonly { column: number; label: string }[];
  bars: readonly TimelineBar[];
}

const TEXT_COLOR = "#111111";
const BAR_TEXT_COLOR = "#FFFFFF";
// Bars cycle through black, WKND blue, red and yellow.
const BAR_COLORS = ["#111111", "#032ABF", "#EB3F0A", "#FBB03A"] as const;
const MUTED_OPACITY = 0.6;
const GUIDE_OPACITY = 0.15;

// The track sits inside the Blue Corners decorations.
const TRACK_X = 200;
const TRACK_WIDTH = 1500;
const DIVIDER_Y = 240;
const MONTH_Y = 268;
const DATE_Y = 320;
const LABEL_HEIGHT = 24;
const GUIDE_TOP = 296;
const GUIDE_BOTTOM = 912;
const BAR_TOP = 416;
const MAX_ROW_STEP = 80;
const BAR_ROW_GAP = 16;
const BAR_LABEL_PADDING = 28;
const LARGE_BAR_FONT_SIZE = 28;
const SMALL_BAR_FONT_SIZE = 20;
const OUTSIDE_LABEL_GAP = 16;
// Rough average glyph width of Plus Jakarta Sans relative to font size.
const AVERAGE_GLYPH_WIDTH = 0.56;

function createRect(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opacity = 1,
  fill: string = TEXT_COLOR,
): ShapeElement {
  return {
    id,
    type: "shape",
    shapeType: "rectangle",
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity,
    locked: false,
    visible: true,
    fill,
    stroke: fill,
    strokeWidth: 0,
  };
}

function estimateTextWidth(text: string, fontSize: number) {
  return Math.ceil(text.length * fontSize * AVERAGE_GLYPH_WIDTH);
}

function createBarLabel(
  id: string,
  label: string,
  barX: number,
  barWidth: number,
  y: number,
  height: number,
  fontSize: number,
) {
  const textWidth = estimateTextWidth(label, fontSize);
  const trackRight = TRACK_X + TRACK_WIDTH;
  const fitsInside = textWidth + BAR_LABEL_PADDING * 2 <= barWidth;
  const outsideWidth = textWidth + 8;
  const rightX = barX + barWidth + OUTSIDE_LABEL_GAP;
  const leftX = barX - OUTSIDE_LABEL_GAP - outsideWidth;
  const shared = { id, text: label, y, height, fontSize };

  // Short bars keep their label readable next to the bar instead of clipping it.
  if (!fitsInside && rightX + outsideWidth <= trackRight) {
    return createLayoutText({
      ...shared,
      x: rightX,
      width: outsideWidth,
      verticalAlign: "middle",
      color: TEXT_COLOR,
    });
  }

  if (!fitsInside && leftX >= TRACK_X) {
    return createLayoutText({
      ...shared,
      x: leftX,
      width: outsideWidth,
      align: "right",
      verticalAlign: "middle",
      color: TEXT_COLOR,
    });
  }

  return createLayoutText({
    ...shared,
    x: barX + BAR_LABEL_PADDING,
    width: Math.max(1, barWidth - BAR_LABEL_PADDING * 2),
    verticalAlign: "middle",
    color: BAR_TEXT_COLOR,
  });
}

export function createTimelineElements(
  model: TimelineModel,
  idPrefix: string,
): SlideElement[] {
  const columnCount = Math.max(1, model.columns.length);
  const columnWidth = TRACK_WIDTH / columnCount;
  const columnX = (column: number) => TRACK_X + column * columnWidth;
  const rowStep = Math.min(
    MAX_ROW_STEP,
    (GUIDE_BOTTOM - BAR_TOP) / Math.max(1, model.bars.length),
  );
  const barHeight =
    rowStep === MAX_ROW_STEP
      ? MAX_ROW_STEP - BAR_ROW_GAP
      : Math.round(rowStep * 0.8);
  const barFontSize =
    barHeight >= 56 ? LARGE_BAR_FONT_SIZE : SMALL_BAR_FONT_SIZE;

  const createColumnLabel = (
    id: string,
    text: string,
    column: number,
    y: number,
  ) =>
    createLayoutText({
      id,
      text,
      x: columnX(column),
      y,
      width: columnWidth,
      height: LABEL_HEIGHT,
      fontSize: 20,
      align: "center",
      opacity: MUTED_OPACITY,
      color: TEXT_COLOR,
    });

  return [
    createRect(
      `${idPrefix}-divider`,
      TRACK_X,
      DIVIDER_Y,
      TRACK_WIDTH,
      1,
      GUIDE_OPACITY,
    ),
    ...Array.from({ length: columnCount + 1 }, (_, index) =>
      createRect(
        `${idPrefix}-guide-${index}`,
        Math.round(columnX(index)),
        GUIDE_TOP,
        1,
        GUIDE_BOTTOM - GUIDE_TOP,
        GUIDE_OPACITY,
      ),
    ),
    ...model.months.map((month, index) =>
      createColumnLabel(
        `${idPrefix}-month-${index}`,
        month.label,
        month.column,
        MONTH_Y,
      ),
    ),
    ...model.columns.map((date, index) =>
      createColumnLabel(`${idPrefix}-date-${index}`, date, index, DATE_Y),
    ),
    ...model.bars.flatMap((bar, index) => {
      const x = Math.round(columnX(bar.start));
      const width = Math.max(4, Math.round(columnX(bar.end)) - x);
      const y = Math.round(BAR_TOP + index * rowStep);

      return [
        {
          ...createRect(
            `${idPrefix}-bar-${index}`,
            x,
            y,
            width,
            barHeight,
            1,
            BAR_COLORS[index % BAR_COLORS.length],
          ),
          // Pill ends; renderers clamp the radius for very short bars.
          shapeType: "roundedRectangle" as const,
          cornerRadius: barHeight / 2,
        },
        createBarLabel(
          `${idPrefix}-bar-${index}-label`,
          bar.label,
          x,
          width,
          y,
          barHeight,
          barFontSize,
        ),
      ];
    }),
  ];
}
