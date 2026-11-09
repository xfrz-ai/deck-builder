"use client";

import type { Node } from "konva/lib/Node";
import type { Rect } from "konva/lib/shapes/Rect";
import type { Transformer as KonvaTransformer } from "konva/lib/shapes/Transformer";
import type { Vector2d } from "konva/lib/types";
import { useLayoutEffect, useRef } from "react";
import { Transformer } from "react-konva";

import {
  SNAP_THRESHOLD_PX,
  type SnapGuides,
  type SnapLines,
  snapPoint,
} from "@/lib/canvas/snapping";
import { MIN_ELEMENT_SIZE } from "@/lib/elements/transform-utils";

interface SelectionTransformerProps {
  allowResize?: boolean;
  getElementNode: (elementId: string) => Node | null;
  // Guides a resize handle snaps to (layout grid plus other elements).
  getSnapGuides: () => SnapGuides;
  isSnapBypassed: () => boolean;
  onSnapLinesChange: (lines: SnapLines | null) => void;
  scale: number;
  selectedElementIds: readonly string[];
}

const ENABLED_ANCHORS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

// Transformer anchors are drawn in screen pixels, independent of canvas zoom.
const ACCENT_COLOR = "#3582FF";
const ANCHOR_STROKE_COLOR = "#D4D4D4";
const ANCHOR_SIZE = 10;
const BORDER_WIDTH = 1;
const ROTATE_OFFSET = 20;
const EDGE_HANDLE_LENGTH = 18;
const EDGE_HANDLE_THICKNESS = 6;

function styleAnchor(anchor: Rect) {
  anchor.shadowColor("rgba(18, 18, 18, 0.18)");
  anchor.shadowBlur(3);
  anchor.shadowOffsetY(1);

  if (anchor.hasName("top-center") || anchor.hasName("bottom-center")) {
    anchor.width(EDGE_HANDLE_LENGTH);
    anchor.height(EDGE_HANDLE_THICKNESS);
  } else if (
    anchor.hasName("middle-left") ||
    anchor.hasName("middle-right")
  ) {
    anchor.width(EDGE_HANDLE_THICKNESS);
    anchor.height(EDGE_HANDLE_LENGTH);
  } else {
    anchor.width(ANCHOR_SIZE);
    anchor.height(ANCHOR_SIZE);
  }

  anchor.offsetX(anchor.width() / 2);
  anchor.offsetY(anchor.height() / 2);
  anchor.cornerRadius(Math.min(anchor.width(), anchor.height()) / 2);
}

export function SelectionTransformer({
  allowResize = true,
  getElementNode,
  getSnapGuides,
  isSnapBypassed,
  onSnapLinesChange,
  scale,
  selectedElementIds,
}: SelectionTransformerProps) {
  const transformerRef = useRef<KonvaTransformer | null>(null);
  // Collected once per resize, on the first handle move.
  const snapGuidesRef = useRef<SnapGuides | null>(null);

  useLayoutEffect(() => {
    const transformer = transformerRef.current;

    if (!transformer) {
      return;
    }

    const selectedNodes = selectedElementIds
      .map(getElementNode)
      .filter((node): node is Node => node !== null);

    transformer.nodes(selectedNodes);
    transformer.forceUpdate();
    transformer.getLayer()?.batchDraw();

    return () => {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    };
  }, [getElementNode, selectedElementIds]);

  const safeScale = Math.max(scale, 0.01);
  const isSingleSelection = selectedElementIds.length === 1 && allowResize;

  // Resize handles snap to guides on the axes they control. Positions are
  // absolute stage pixels, i.e. logical pixels times the scale.
  const snapAnchor = (_oldPosition: Vector2d, position: Vector2d) => {
    const transformer = transformerRef.current;
    const anchor = transformer?.getActiveAnchor();
    const node = transformer?.nodes()[0];

    // The rotate handle uses this too; rotated boxes have no straight edges.
    if (
      !anchor ||
      anchor === "rotater" ||
      !node ||
      node.rotation() !== 0 ||
      isSnapBypassed()
    ) {
      onSnapLinesChange(null);
      return position;
    }

    snapGuidesRef.current ??= getSnapGuides();
    const { lines, point } = snapPoint(
      { x: position.x / safeScale, y: position.y / safeScale },
      snapGuidesRef.current,
      SNAP_THRESHOLD_PX / safeScale,
      { x: !anchor.endsWith("center"), y: !anchor.startsWith("middle") },
    );

    onSnapLinesChange(lines);
    return { x: point.x * safeScale, y: point.y * safeScale };
  };

  return (
    <Transformer
      anchorDragBoundFunc={snapAnchor}
      anchorFill="#FFFFFF"
      anchorSize={ANCHOR_SIZE}
      anchorStroke={ANCHOR_STROKE_COLOR}
      anchorStrokeWidth={1}
      anchorStyleFunc={styleAnchor}
      borderStroke={ACCENT_COLOR}
      borderStrokeWidth={BORDER_WIDTH}
      boundBoxFunc={(oldBox, newBox) => {
        const minimumAbsoluteSize = MIN_ELEMENT_SIZE * safeScale;

        return newBox.width < minimumAbsoluteSize ||
          newBox.height < minimumAbsoluteSize
          ? oldBox
          : newBox;
      }}
      enabledAnchors={isSingleSelection ? ENABLED_ANCHORS : []}
      flipEnabled={false}
      keepRatio={false}
      onTransformEnd={() => {
        snapGuidesRef.current = null;
        onSnapLinesChange(null);
      }}
      ref={transformerRef}
      resizeEnabled={isSingleSelection}
      rotateAnchorOffset={ROTATE_OFFSET}
      rotateEnabled={isSingleSelection}
      rotateLineVisible={false}
      shouldOverdrawWholeArea={false}
    />
  );
}
