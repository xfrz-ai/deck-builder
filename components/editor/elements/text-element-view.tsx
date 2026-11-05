"use client";

import type { Group as KonvaGroup } from "konva/lib/Group";
import type { KonvaEventObject, Node } from "konva/lib/Node";
import { useCallback } from "react";
import { Group, Text } from "react-konva";

import {
  getCanvasFontFamily,
  getKonvaFontStyle,
} from "@/lib/text/text-utils";
import type { TextElement } from "@/types/presentation";

interface TextElementViewProps {
  element: TextElement;
  interactive: boolean;
  isEditing?: boolean;
  onDragEnd?: (position: { x: number; y: number }) => void;
  onDragMove?: (node: Node) => void;
  onDragStart?: (node: Node) => void;
  onEdit?: () => void;
  onNodeChange?: (elementId: string, node: Node | null) => void;
  onSelect?: (additive: boolean) => void;
  onTransformEnd?: (node: Node) => void;
}

export function TextElementView({
  element,
  interactive,
  isEditing = false,
  onDragEnd,
  onDragMove,
  onDragStart,
  onEdit,
  onNodeChange,
  onSelect,
  onTransformEnd,
}: TextElementViewProps) {
  const canDrag = interactive && !element.locked && !isEditing;
  const setNodeRef = useCallback(
    (node: KonvaGroup | null) => onNodeChange?.(element.id, node),
    [element.id, onNodeChange],
  );

  const setCursor = (
    event: KonvaEventObject<Event>,
    cursor: "default" | "grabbing" | "move" | "text",
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

  const handleEdit = (event: KonvaEventObject<Event>) => {
    event.cancelBubble = true;
    onSelect?.(false);
    onEdit?.();
  };

  return (
    <Group
      draggable={canDrag}
      height={element.height}
      listening={interactive && !element.locked}
      onContextMenu={interactive ? handleSelect : undefined}
      onDblClick={interactive ? handleEdit : undefined}
      onDblTap={interactive ? handleEdit : undefined}
      onDragEnd={
        interactive
          ? (event) => {
              setCursor(event, canDrag ? "move" : "default");
              onDragEnd?.({ x: event.target.x(), y: event.target.y() });
            }
          : undefined
      }
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
          ? (event) =>
              setCursor(
                event,
                isEditing ? "text" : canDrag ? "move" : "default",
              )
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
      <Text
        align={element.align}
        fill={element.color}
        fontFamily={getCanvasFontFamily(element.fontFamily)}
        fontSize={element.fontSize}
        fontStyle={getKonvaFontStyle(element)}
        height={element.height}
        letterSpacing={element.letterSpacing}
        lineHeight={element.lineHeight}
        opacity={isEditing ? 0 : element.opacity}
        padding={element.padding ?? 0}
        text={element.text}
        textDecoration={element.textDecoration ?? "none"}
        verticalAlign={element.verticalAlign}
        width={element.width}
        wrap="word"
      />
    </Group>
  );
}
