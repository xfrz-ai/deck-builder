"use client";

import type { Group as KonvaGroup } from "konva/lib/Group";
import type { KonvaEventObject, Node } from "konva/lib/Node";
import { useCallback } from "react";
import { Group, Image as KonvaImage, Rect, Text } from "react-konva";

import { useLoadedImage } from "@/hooks/use-loaded-image";
import { calculateCoverCrop } from "@/lib/image/image-fit";
import type { ImageElement } from "@/types/presentation";

interface ImageElementViewProps {
  element: ImageElement;
  interactive: boolean;
  onDragEnd?: (position: { x: number; y: number }) => void;
  onDragMove?: (node: Node) => void;
  onDragStart?: (node: Node) => void;
  onNodeChange?: (elementId: string, node: Node | null) => void;
  onSelect?: (additive: boolean) => void;
  onTransformEnd?: (node: Node) => void;
}

export function ImageElementView({
  element,
  interactive,
  onDragEnd,
  onDragMove,
  onDragStart,
  onNodeChange,
  onSelect,
  onTransformEnd,
}: ImageElementViewProps) {
  const { error, image } = useLoadedImage(element.src);
  const canDrag = interactive && !element.locked;
  const cornerRadius = Math.min(
    Math.max(0, element.cornerRadius),
    element.width / 2,
    element.height / 2,
  );
  const crop =
    image && element.fit === "cover"
      ? calculateCoverCrop(
          image.naturalWidth,
          image.naturalHeight,
          element.width,
          element.height,
        )
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

  return (
    <Group
      draggable={canDrag}
      height={element.height}
      listening={interactive && !element.locked}
      onContextMenu={interactive ? handleSelect : undefined}
      onDragMove={
        interactive ? (event) => onDragMove?.(event.target) : undefined
      }
      onDragEnd={
        interactive
          ? (event) => {
              setCursor(event, canDrag ? "move" : "default");
              onDragEnd?.({ x: event.target.x(), y: event.target.y() });
            }
          : undefined
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
      opacity={element.opacity}
      ref={setNodeRef}
      rotation={element.rotation}
      visible={element.visible !== false}
      width={element.width}
      x={element.x}
      y={element.y}
    >
      {image ? (
        <KonvaImage
          cornerRadius={cornerRadius}
          crop={crop}
          height={element.height}
          image={image}
          width={element.width}
        />
      ) : (
        <>
          <Rect
            cornerRadius={cornerRadius}
            fill={error ? "#f4eeee" : "#f0f0f3"}
            height={element.height}
            stroke={error ? "#d9bfc2" : "#dedee4"}
            strokeWidth={1}
            width={element.width}
          />
          {error ? (
            <Text
              align="center"
              fill="#8a666a"
              fontFamily="Inter, sans-serif"
              fontSize={Math.min(28, Math.max(12, element.height / 8))}
              height={element.height}
              text="Image unavailable"
              verticalAlign="middle"
              width={element.width}
            />
          ) : null}
        </>
      )}
    </Group>
  );
}
