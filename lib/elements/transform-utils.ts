import type { Node } from "konva/lib/Node";

export const MIN_ELEMENT_SIZE = 20;

export interface NormalizedElementTransform {
  height: number;
  rotation: number;
  width: number;
  x: number;
  y: number;
}

function isFiniteTransformValue(value: number) {
  return Number.isFinite(value);
}

export function normalizeTransform(
  node: Node,
  minimumSize = MIN_ELEMENT_SIZE,
): NormalizedElementTransform | null {
  const width = Math.max(minimumSize, Math.abs(node.width() * node.scaleX()));
  const height = Math.max(
    minimumSize,
    Math.abs(node.height() * node.scaleY()),
  );
  const transform = {
    x: node.x(),
    y: node.y(),
    width,
    height,
    rotation: node.rotation(),
  };

  if (Object.values(transform).some((value) => !isFiniteTransformValue(value))) {
    node.scaleX(1);
    node.scaleY(1);
    return null;
  }

  node.scaleX(1);
  node.scaleY(1);
  node.width(width);
  node.height(height);

  return transform;
}
