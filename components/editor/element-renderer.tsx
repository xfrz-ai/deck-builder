"use client";

import type { Node } from "konva/lib/Node";

import { ImageElementView } from "@/components/editor/elements/image-element-view";
import { ShapeElementView } from "@/components/editor/elements/shape-element-view";
import { TextElementView } from "@/components/editor/elements/text-element-view";
import type { SlideElement } from "@/types/presentation";

interface ElementRendererProps {
  element: SlideElement;
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

export function ElementRenderer({
  element,
  interactive,
  isEditing,
  onDragEnd,
  onDragMove,
  onDragStart,
  onEdit,
  onNodeChange,
  onSelect,
  onTransformEnd,
}: ElementRendererProps) {
  if (element.visible === false) {
    return null;
  }

  switch (element.type) {
    case "shape":
      return (
        <ShapeElementView
          element={element}
          interactive={interactive}
          onDragEnd={onDragEnd}
          onDragMove={onDragMove}
          onDragStart={onDragStart}
          onNodeChange={onNodeChange}
          onSelect={onSelect}
          onTransformEnd={onTransformEnd}
        />
      );
    case "text":
      return (
        <TextElementView
          element={element}
          interactive={interactive}
          isEditing={isEditing}
          onDragEnd={onDragEnd}
          onDragMove={onDragMove}
          onDragStart={onDragStart}
          onEdit={onEdit}
          onNodeChange={onNodeChange}
          onSelect={onSelect}
          onTransformEnd={onTransformEnd}
        />
      );
    case "image":
      return (
        <ImageElementView
          element={element}
          interactive={interactive}
          onDragEnd={onDragEnd}
          onDragMove={onDragMove}
          onDragStart={onDragStart}
          onNodeChange={onNodeChange}
          onSelect={onSelect}
          onTransformEnd={onTransformEnd}
        />
      );
  }
}
