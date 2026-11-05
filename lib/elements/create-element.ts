import { createUniqueId } from "@/lib/id";
import type { ShapeElement, TextElement } from "@/types/presentation";

export type ShapeType = ShapeElement["shapeType"];

const DEFAULT_SHAPE = {
  type: "shape",
  x: 300,
  y: 250,
  width: 320,
  height: 200,
  rotation: 0,
  opacity: 1,
  fill: "#E7E5FF",
  stroke: "#7C6CF2",
  strokeWidth: 0,
  visible: true,
  locked: false,
} as const;

export function createShapeElement(shapeType: ShapeType): ShapeElement {
  const dimensions =
    shapeType === "circle"
      ? { width: 240, height: 240 }
      : { width: DEFAULT_SHAPE.width, height: DEFAULT_SHAPE.height };

  return {
    ...DEFAULT_SHAPE,
    ...dimensions,
    id: createUniqueId("element"),
    shapeType,
    ...(shapeType === "roundedRectangle" ? { cornerRadius: 24 } : {}),
  };
}

export function createRectangleElement() {
  return createShapeElement("rectangle");
}

export function createRoundedRectangleElement() {
  return createShapeElement("roundedRectangle");
}

export function createCircleElement() {
  return createShapeElement("circle");
}

export function createTextElement(): TextElement {
  return {
    id: createUniqueId("element"),
    type: "text",
    x: 240,
    y: 180,
    width: 700,
    height: 140,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    text: "Type something",
    fontFamily: "Inter",
    fontSize: 64,
    fontWeight: 400,
    italic: false,
    color: "#111111",
    align: "left",
    verticalAlign: "top",
    lineHeight: 1.2,
    letterSpacing: 0,
    textDecoration: "none",
    padding: 0,
  };
}
