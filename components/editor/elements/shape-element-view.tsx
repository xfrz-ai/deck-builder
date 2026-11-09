"use client";

import type { Group as KonvaGroup } from "konva/lib/Group";
import type { KonvaEventObject, Node } from "konva/lib/Node";
import { useCallback } from "react";
import { Ellipse, Group, Line, Rect } from "react-konva";

import type { ShapeElement } from "@/types/presentation";

interface ShapeElementViewProps {
  element: ShapeElement;
  interactive: boolean;
  onDragEnd?: (position: { x: number; y: number }) => void;
  onDragMove?: (node: Node) => void;
  onDragStart?: (node: Node) => void;
  onNodeChange?: (elementId: string, node: Node | null) => void;
  onSelect?: (additive: boolean) => void;
  onTransformEnd?: (node: Node) => void;
}

export function ShapeElementView({
  element,
  interactive,
  onDragEnd,
  onDragMove,
  onDragStart,
  onNodeChange,
  onSelect,
  onTransformEnd,
}: ShapeElementViewProps) {
  const isCircle = element.shapeType === "circle";
  // A rectangle with no height (or width) is a straight rule. Drawing it as
  // a Rect strokes the same edge out and back, so a dash pattern overlaps
  // itself and can look solid; a Line strokes it once.
  const isRule = !isCircle && (element.height === 0 || element.width === 0);
  const canDrag = interactive && !element.locked;
  const dash = element.dashed
    ? [element.strokeWidth * 4, element.strokeWidth * 3]
    : undefined;

  const setNodeRef = useCallback(
    (node: KonvaGroup | null) => onNodeChange?.(element.id, node),
    [element.id, onNodeChange],
  );

  const setCursor = (
    event: KonvaEventObject<Event>,
    cursor: "default" | "grabbing" | "move",
  ) => {
    const stage = event.target.getStage();

    if (stage) {
      stage.container().style.cursor = cursor;
    }
  };

  const handleSelect = (event: KonvaEventObject<Event>) => {
    event.cancelBubble = true;
    const nativeEvent = event.evt as MouseEvent | TouchEvent;
    onSelect?.("shiftKey" in nativeEvent && nativeEvent.shiftKey);
  };

  const handleDragEnd = (event: KonvaEventObject<DragEvent>) => {
    setCursor(event, canDrag ? "move" : "default");
    onDragEnd?.({ x: event.target.x(), y: event.target.y() });
  };

  return (
    <Group
      draggable={canDrag}
      height={element.height}
      listening={interactive && !element.locked}
      onContextMenu={interactive ? handleSelect : undefined}
      onDragEnd={interactive ? handleDragEnd : undefined}
      onDragMove={
        interactive ? (event) => onDragMove?.(event.target) : undefined
      }
      onDragStart={
        interactive
          ? (event) => {
              handleSelect(event);
              setCursor(event, "grabbing");
              onDragStart?.(event.target);
            }
          : undefined
      }
      onMouseDown={interactive ? handleSelect : undefined}
      onMouseEnter={
        interactive
          ? (event) => setCursor(event, canDrag ? "move" : "default")
          : undefined
      }
      onMouseLeave={
        interactive ? (event) => setCursor(event, "default") : undefined
      }
      onTap={interactive ? handleSelect : undefined}
      onTransformEnd={
        interactive ? (event) => onTransformEnd?.(event.target) : undefined
      }
      ref={setNodeRef}
      rotation={element.rotation}
      visible={element.visible !== false}
      width={element.width}
      x={element.x}
      y={element.y}
    >
      {isCircle ? (
        <Ellipse
          fill={element.fill}
          opacity={element.opacity}
          radiusX={element.width / 2}
          radiusY={element.height / 2}
          dash={dash}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
          x={element.width / 2}
          y={element.height / 2}
        />
      ) : isRule ? (
        <Line
          dash={dash}
          hitStrokeWidth={Math.max(element.strokeWidth, 12)}
          opacity={element.opacity}
          points={[0, 0, element.width, element.height]}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
        />
      ) : (
        <Rect
          cornerRadius={
            element.shapeType === "roundedRectangle" ? element.cornerRadius : 0
          }
          fill={element.fill}
          height={element.height}
          opacity={element.opacity}
          dash={dash}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
          width={element.width}
        />
      )}
    </Group>
  );
}
