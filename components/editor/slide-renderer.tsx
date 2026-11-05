"use client";

import type { KonvaEventObject, Node } from "konva/lib/Node";
import { useCallback, useEffect, useRef, useState } from "react";
import { Layer, Line, Rect, Stage } from "react-konva";

import { ElementRenderer } from "@/components/editor/element-renderer";
import { SelectionTransformer } from "@/components/editor/selection-transformer";
import {
  getElementGuides,
  getLayoutGuides,
  hasSnapLines,
  mergeGuides,
  SNAP_THRESHOLD_PX,
  type SnapGuides,
  type SnapLines,
  type SnapRect,
  snapBox,
  unionRects,
} from "@/lib/canvas/snapping";
import {
  normalizeTransform,
  type NormalizedElementTransform,
} from "@/lib/elements/transform-utils";
import { gridX, gridY, LAYOUT_GRID } from "@/lib/layouts/layout-grid";
import type { Slide } from "@/types/presentation";

const SNAP_LINE_COLOR = "#FF3D7F";
// Column and row strips overlap, so 48px modules read slightly darker.
const GRID_TRACK_FILL = "rgba(235, 63, 10, 0.045)";
const GRID_MARGIN_STROKE = "rgba(235, 63, 10, 0.45)";

export interface SlideRendererProps {
  logicalHeight: number;
  logicalWidth: number;
  interactive?: boolean;
  editingElementId?: string | null;
  onCanvasPointerDown?: () => void;
  onElementsDragEnd?: (
    positions: readonly { elementId: string; x: number; y: number }[],
  ) => void;
  onElementsSelect?: (elementIds: readonly string[]) => void;
  onElementSelect?: (elementId: string, additive: boolean) => void;
  onElementEdit?: (elementId: string) => void;
  onElementTransformEnd?: (
    elementId: string,
    transform: NormalizedElementTransform,
  ) => void;
  scale: number;
  selectedElementIds?: readonly string[];
  // Shows the 24×12 layout grid over the slide (editor only).
  showLayoutGrid?: boolean;
  slide: Slide;
}

interface Point {
  x: number;
  y: number;
}

interface SelectionBox extends Point {
  height: number;
  width: number;
}

interface DragSession {
  // Union of the dragged elements' boxes at drag start, for snapping.
  bounds: SnapRect | null;
  draggedElementId: string;
  guides: SnapGuides;
  positions: Map<string, Point>;
}

function normalizeSelectionBox(start: Point, end: Point): SelectionBox {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function boxesIntersect(first: SelectionBox, second: SelectionBox) {
  return !(
    first.x + first.width < second.x ||
    second.x + second.width < first.x ||
    first.y + first.height < second.y ||
    second.y + second.height < first.y
  );
}

export default function SlideRenderer({
  logicalHeight,
  logicalWidth,
  interactive = false,
  editingElementId,
  onCanvasPointerDown,
  onElementsDragEnd,
  onElementsSelect,
  onElementSelect,
  onElementEdit,
  onElementTransformEnd,
  scale,
  selectedElementIds = [],
  showLayoutGrid = false,
  slide,
}: SlideRendererProps) {
  const elementNodesRef = useRef<Map<string, Node>>(new Map());
  const dragSessionRef = useRef<DragSession | null>(null);
  const selectionStartRef = useRef<Point | null>(null);
  const selectionBoxRef = useRef<SelectionBox | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(
    null,
  );
  const [snapLines, setSnapLines] = useState<SnapLines | null>(null);
  const snapLinesKeyRef = useRef("");
  // Holding Cmd/Ctrl moves and resizes freely, without snapping.
  const snapBypassRef = useRef(false);

  useEffect(() => {
    if (!interactive) {
      return;
    }

    const updateBypass = (event: KeyboardEvent) => {
      snapBypassRef.current = event.metaKey || event.ctrlKey;
    };
    const resetBypass = () => {
      snapBypassRef.current = false;
    };

    window.addEventListener("keydown", updateBypass);
    window.addEventListener("keyup", updateBypass);
    window.addEventListener("blur", resetBypass);
    return () => {
      window.removeEventListener("keydown", updateBypass);
      window.removeEventListener("keyup", updateBypass);
      window.removeEventListener("blur", resetBypass);
    };
  }, [interactive]);

  // Only re-renders when the shown guide lines actually change.
  const showSnapLines = useCallback((lines: SnapLines | null) => {
    const next = lines && hasSnapLines(lines) ? lines : null;
    const key = next ? JSON.stringify(next) : "";

    if (key !== snapLinesKeyRef.current) {
      snapLinesKeyRef.current = key;
      setSnapLines(next);
    }
  }, []);
  const registerElementNode = useCallback(
    (elementId: string, node: Node | null) => {
      if (node) {
        elementNodesRef.current.set(elementId, node);
      } else {
        elementNodesRef.current.delete(elementId);
      }
    },
    [],
  );
  const getElementNode = useCallback(
    (elementId: string) => elementNodesRef.current.get(elementId) ?? null,
    [],
  );
  const getNodeRect = useCallback((elementId: string): SnapRect | null => {
    const node = elementNodesRef.current.get(elementId);
    const layer = node?.getLayer();

    return node && layer
      ? node.getClientRect({ relativeTo: layer, skipShadow: true })
      : null;
  }, []);

  // Layout grid lines plus the edges and centres of every other element.
  const getSnapGuides = useCallback(
    (excludedIds: ReadonlySet<string>) =>
      mergeGuides(
        getLayoutGuides(),
        getElementGuides(
          slide.elements.flatMap((element) => {
            const rect =
              excludedIds.has(element.id) ||
              element.visible === false ||
              element.role === "background"
                ? null
                : getNodeRect(element.id);

            return rect ? [rect] : [];
          }),
        ),
      ),
    [getNodeRect, slide.elements],
  );
  const transformableSelectedElementIds = selectedElementIds.filter(
    (elementId) => {
      const element = slide.elements.find((item) => item.id === elementId);
      return element && element.visible !== false && !element.locked;
    },
  );

  const getLogicalPointerPosition = useCallback(
    (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
      const pointer = event.target.getStage()?.getPointerPosition();

      return pointer
        ? { x: pointer.x / scale, y: pointer.y / scale }
        : null;
    },
    [scale],
  );

  const handleCanvasMouseDown = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      const pointer = getLogicalPointerPosition(event);

      onCanvasPointerDown?.();
      if (!pointer) {
        return;
      }

      selectionStartRef.current = pointer;
      const initialBox = { ...pointer, width: 0, height: 0 };
      selectionBoxRef.current = initialBox;
      setSelectionBox(initialBox);
    },
    [getLogicalPointerPosition, onCanvasPointerDown],
  );

  const handleCanvasMouseMove = useCallback(
    (event: KonvaEventObject<MouseEvent>) => {
      const start = selectionStartRef.current;
      const pointer = getLogicalPointerPosition(event);

      if (!start || !pointer) {
        return;
      }

      const nextBox = normalizeSelectionBox(start, pointer);
      selectionBoxRef.current = nextBox;
      setSelectionBox(nextBox);
    },
    [getLogicalPointerPosition],
  );

  const handleCanvasMouseUp = useCallback(() => {
    const box = selectionBoxRef.current;
    selectionStartRef.current = null;
    selectionBoxRef.current = null;
    setSelectionBox(null);

    if (!box || box.width < 3 / scale || box.height < 3 / scale) {
      return;
    }

    const selectedIds = slide.elements
      .filter(
        (element) =>
          !element.locked &&
          element.visible !== false &&
          element.role !== "background",
      )
      .filter((element) => {
        const node = elementNodesRef.current.get(element.id);
        const layer = node?.getLayer();

        if (!node || !layer) {
          return false;
        }

        return boxesIntersect(box, node.getClientRect({ relativeTo: layer }));
      })
      .map((element) => element.id);

    onElementsSelect?.(selectedIds);
  }, [onElementsSelect, scale, slide.elements]);

  const handleElementDragStart = useCallback(
    (elementId: string, node: Node) => {
      if (dragSessionRef.current) {
        return;
      }

      const dragIds = selectedElementIds.includes(elementId)
        ? transformableSelectedElementIds
        : [elementId];
      const positions = new Map<string, Point>();

      dragIds.forEach((id) => {
        const selectedNode =
          id === elementId ? node : elementNodesRef.current.get(id);

        if (selectedNode) {
          positions.set(id, {
            x: selectedNode.x(),
            y: selectedNode.y(),
          });
        }
      });

      const draggedIds = new Set(positions.keys());

      dragSessionRef.current = {
        bounds: unionRects(
          [...draggedIds].flatMap((id) => {
            const rect = getNodeRect(id);
            return rect ? [rect] : [];
          }),
        ),
        draggedElementId: elementId,
        guides: getSnapGuides(draggedIds),
        positions,
      };
    },
    [
      getNodeRect,
      getSnapGuides,
      selectedElementIds,
      transformableSelectedElementIds,
    ],
  );

  const handleElementDragMove = useCallback(
    (elementId: string, node: Node) => {
      const session = dragSessionRef.current;

      if (!session || session.draggedElementId !== elementId) {
        return;
      }

      const origin = session.positions.get(elementId);
      if (!origin) {
        return;
      }

      let deltaX = node.x() - origin.x;
      let deltaY = node.y() - origin.y;

      if (session.bounds && !snapBypassRef.current) {
        const snap = snapBox(
          {
            ...session.bounds,
            x: session.bounds.x + deltaX,
            y: session.bounds.y + deltaY,
          },
          session.guides,
          SNAP_THRESHOLD_PX / scale,
        );

        if (snap.dx !== 0 || snap.dy !== 0) {
          deltaX += snap.dx;
          deltaY += snap.dy;
          node.position({ x: origin.x + deltaX, y: origin.y + deltaY });
        }

        showSnapLines(snap.lines);
      } else {
        showSnapLines(null);
      }

      session.positions.forEach((position, id) => {
        if (id === elementId) {
          return;
        }

        elementNodesRef.current.get(id)?.position({
          x: position.x + deltaX,
          y: position.y + deltaY,
        });
      });
      node.getLayer()?.batchDraw();
    },
    [scale, showSnapLines],
  );

  const handleElementDragEnd = useCallback(
    (elementId: string, position: Point) => {
      const session = dragSessionRef.current;
      showSnapLines(null);

      if (!session) {
        onElementsDragEnd?.([{ elementId, ...position }]);
        return;
      }

      if (session.draggedElementId !== elementId) {
        return;
      }

      const positions = [...session.positions.keys()].map((id) => {
        const node = elementNodesRef.current.get(id);
        const fallback = session.positions.get(id) ?? position;

        return {
          elementId: id,
          x: node?.x() ?? fallback.x,
          y: node?.y() ?? fallback.y,
        };
      });

      onElementsDragEnd?.(positions);
      queueMicrotask(() => {
        if (dragSessionRef.current === session) {
          dragSessionRef.current = null;
        }
      });
    },
    [onElementsDragEnd, showSnapLines],
  );

  return (
    <Stage
      height={logicalHeight * scale}
      onMouseMove={interactive ? handleCanvasMouseMove : undefined}
      onMouseUp={interactive ? handleCanvasMouseUp : undefined}
      scaleX={scale}
      scaleY={scale}
      width={logicalWidth * scale}
    >
      <Layer listening={interactive}>
        <Rect
          fill={slide.background}
          height={logicalHeight}
          listening={interactive}
          onContextMenu={interactive ? onCanvasPointerDown : undefined}
          onMouseDown={interactive ? handleCanvasMouseDown : undefined}
          onTap={interactive ? onCanvasPointerDown : undefined}
          width={logicalWidth}
          x={0}
          y={0}
        />
        {slide.elements.map((element) => (
          <ElementRenderer
            element={element}
            interactive={interactive}
            isEditing={editingElementId === element.id}
            key={element.id}
            onDragEnd={(position) =>
              handleElementDragEnd(element.id, position)
            }
            onDragMove={(node) =>
              handleElementDragMove(element.id, node)
            }
            onDragStart={(node) =>
              handleElementDragStart(element.id, node)
            }
            onNodeChange={interactive ? registerElementNode : undefined}
            onEdit={() => onElementEdit?.(element.id)}
            onSelect={(additive) =>
              onElementSelect?.(element.id, additive)
            }
            onTransformEnd={
              selectedElementIds.length === 1
                ? (node) => {
                    const transform = normalizeTransform(node);

                    if (transform) {
                      onElementTransformEnd?.(element.id, transform);
                    }

                    node.getLayer()?.batchDraw();
                  }
                : undefined
            }
          />
        ))}
        {interactive && showLayoutGrid ? (
          <>
            {Array.from({ length: LAYOUT_GRID.columns }, (_, index) => (
              <Rect
                fill={GRID_TRACK_FILL}
                height={logicalHeight}
                key={`grid-column-${index}`}
                listening={false}
                width={LAYOUT_GRID.columnWidth}
                x={gridX(index + 1)}
                y={0}
              />
            ))}
            {Array.from({ length: LAYOUT_GRID.rows }, (_, index) => (
              <Rect
                fill={GRID_TRACK_FILL}
                height={LAYOUT_GRID.rowHeight}
                key={`grid-row-${index}`}
                listening={false}
                width={logicalWidth}
                x={0}
                y={gridY(index + 1)}
              />
            ))}
            {[
              LAYOUT_GRID.marginY,
              logicalHeight - LAYOUT_GRID.marginY,
            ].map((y) => (
              <Line
                dash={[6 / scale, 4 / scale]}
                key={`grid-margin-${y}`}
                listening={false}
                points={[0, y, logicalWidth, y]}
                stroke={GRID_MARGIN_STROKE}
                strokeWidth={1 / scale}
              />
            ))}
          </>
        ) : null}
        {interactive && snapLines ? (
          <>
            {snapLines.vertical.map((x) => (
              <Line
                key={`snap-x-${x}`}
                listening={false}
                points={[x, 0, x, logicalHeight]}
                stroke={SNAP_LINE_COLOR}
                strokeWidth={1 / scale}
              />
            ))}
            {snapLines.horizontal.map((y) => (
              <Line
                key={`snap-y-${y}`}
                listening={false}
                points={[0, y, logicalWidth, y]}
                stroke={SNAP_LINE_COLOR}
                strokeWidth={1 / scale}
              />
            ))}
          </>
        ) : null}
        {interactive && selectionBox ? (
          <Rect
            dash={[6 / scale, 4 / scale]}
            fill="rgba(53, 130, 255, 0.10)"
            height={selectionBox.height}
            listening={false}
            stroke="#3582FF"
            strokeWidth={1.5 / scale}
            width={selectionBox.width}
            x={selectionBox.x}
            y={selectionBox.y}
          />
        ) : null}
        {interactive && transformableSelectedElementIds.length > 0 ? (
          <SelectionTransformer
            getElementNode={getElementNode}
            getSnapGuides={() =>
              getSnapGuides(new Set(transformableSelectedElementIds))
            }
            isSnapBypassed={() => snapBypassRef.current}
            onSnapLinesChange={showSnapLines}
            scale={scale}
            selectedElementIds={transformableSelectedElementIds}
          />
        ) : null}
      </Layer>
    </Stage>
  );
}
