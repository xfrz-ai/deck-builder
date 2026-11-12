"use client";

import { useEffect, useRef, useState } from "react";

import { ClientSlideRenderer } from "@/components/editor/client-slide-renderer";
import { AgentCanvasHighlight } from "@/components/editor/local-deck-session";
import { ElementContextMenu } from "@/components/editor/element-context-menu";
import { ImageContextualToolbar } from "@/components/editor/image-contextual-toolbar";
import { TableCellChoices } from "@/components/editor/table-cell-choices";
import { getTableCellChoices, getTableCellText } from "@/lib/table/table-model";
import { TextEditorOverlay } from "@/components/editor/text-editor-overlay";
import { TextContextualToolbar } from "@/components/editor/text-contextual-toolbar";
import { TopBar } from "@/components/editor/top-bar";
import { ZoomControls } from "@/components/editor/zoom-controls";
import {
  calculateFitScale,
  FIT_HORIZONTAL_PADDING,
  FIT_VERTICAL_PADDING,
} from "@/lib/canvas/zoom";
import { getCanvasFont } from "@/lib/text/measure-text";
import { selectActiveSlide, useEditorStore } from "@/store/editor-store";

interface WorkspaceSize {
  height: number;
  width: number;
}

// The canvas sits between the floating side panels and below the toolbar.
const WORKSPACE_CLASS_NAME = "absolute inset-y-0 left-[252px] right-[292px]";

export function CanvasWorkspace() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<WorkspaceSize>({
    height: 0,
    width: 0,
  });
  const [fitScale, setFitScale] = useState(1);
  const [plainTableCellId, setPlainTableCellId] = useState<string | null>(null);

  const presentationWidth = useEditorStore(
    (state) => state.presentation.width,
  );
  const presentationHeight = useEditorStore(
    (state) => state.presentation.height,
  );
  const activeSlide = useEditorStore(selectActiveSlide);
  const zoom = useEditorStore((state) => state.zoom);
  const zoomMode = useEditorStore((state) => state.zoomMode);
  const showLayoutGrid = useEditorStore((state) => state.showLayoutGrid);
  const fitToWorkspace = useEditorStore((state) => state.fitToWorkspace);
  const selectedElementIds = useEditorStore(
    (state) => state.selectedElementIds,
  );
  const selectElement = useEditorStore((state) => state.selectElement);
  const selectElements = useEditorStore((state) => state.selectElements);
  const editingTextId = useEditorStore((state) => state.editingTextId);
  const editingTextSelectAll = useEditorStore(
    (state) => state.editingTextSelectAll,
  );
  const startTextEditing = useEditorStore(
    (state) => state.startTextEditing,
  );
  const stopTextEditing = useEditorStore((state) => state.stopTextEditing);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const openAgendaEditor = useEditorStore((state) => state.openAgendaEditor);
  const selectAgendaGraphic = useEditorStore((state) => state.selectAgendaGraphic);
  const openTeamEditor = useEditorStore((state) => state.openTeamEditor);
  const selectTeamGraphic = useEditorStore((state) => state.selectTeamGraphic);
  const openTimelineEditor = useEditorStore((state) => state.openTimelineEditor);
  const selectTimelineGraphic = useEditorStore((state) => state.selectTimelineGraphic);
  const selectTableGraphic = useEditorStore((state) => state.selectTableGraphic);
  const updateTableCellText = useEditorStore((state) => state.updateTableCellText);
  const navigateTableCell = useEditorStore((state) => state.navigateTableCell);
  const updateElement = useEditorStore((state) => state.updateElement);
  const updateElements = useEditorStore((state) => state.updateElements);
  const reflowTextBlocks = useEditorStore((state) => state.reflowTextBlocks);

  useEffect(() => { setPlainTableCellId(null); }, [editingTextId]);

  useEffect(() => {
    let mounted = true;
    const reflow = () => { if (mounted) reflowTextBlocks(); };
    Promise.allSettled([
      document.fonts.load(getCanvasFont("Plus Jakarta Sans", 28, 400)),
      document.fonts.load(getCanvasFont("Plus Jakarta Sans", 72, 700)),
    ]).then(reflow);
    document.fonts.addEventListener("loadingdone", reflow);
    return () => { mounted = false; document.fonts.removeEventListener("loadingdone", reflow); };
  }, [reflowTextBlocks]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const updateWorkspaceSize = (width: number, height: number) => {
      const nextFitScale = calculateFitScale(
        width,
        height,
        presentationWidth,
        presentationHeight,
      );

      setViewportSize({ width, height });
      setFitScale(nextFitScale);

      if (zoomMode === "fit") {
        fitToWorkspace(nextFitScale);
      }
    };

    const initialBounds = viewport.getBoundingClientRect();
    updateWorkspaceSize(initialBounds.width, initialBounds.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry) {
        updateWorkspaceSize(
          entry.contentRect.width,
          entry.contentRect.height,
        );
      }
    });

    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitToWorkspace, presentationHeight, presentationWidth, zoomMode]);

  if (!activeSlide) {
    return (
      <main
        className={`${WORKSPACE_CLASS_NAME} flex items-center justify-center text-[13px] text-muted-foreground`}
      >
        No slide selected
      </main>
    );
  }

  const canvasWidth = presentationWidth * zoom;
  const canvasHeight = presentationHeight * zoom;
  const scrollContentWidth = Math.max(
    viewportSize.width,
    canvasWidth + FIT_HORIZONTAL_PADDING,
  );
  const scrollContentHeight = Math.max(
    viewportSize.height,
    canvasHeight + FIT_VERTICAL_PADDING,
  );
  const isMeasured = viewportSize.width > 0 && viewportSize.height > 0;
  const editingElement = activeSlide.elements.find(
    (element) => element.id === editingTextId,
  );
  const editingText = editingElement?.type === "text" ? editingElement : undefined;
  const tableChoices = editingText?.tableCell && activeSlide.table && plainTableCellId !== editingText.id ? getTableCellChoices(activeSlide.table, editingText.tableCell) : null;
  const overlayText = editingText?.tableCell && activeSlide.table ? { ...editingText, text: getTableCellText(activeSlide.table, editingText.tableCell) } : editingText;

  return (
    <main className={`${WORKSPACE_CLASS_NAME} overflow-hidden`}>
      <div
        className="editor-scrollbar absolute inset-x-0 bottom-0 top-[70px] overflow-auto"
        ref={viewportRef}
      >
        <div
          className="flex items-center justify-center"
          style={{
            height: scrollContentHeight,
            width: scrollContentWidth,
          }}
        >
          {isMeasured ? (
            <ElementContextMenu>
              <div
                aria-label={`Slide canvas, ${presentationWidth} by ${presentationHeight} logical pixels`}
                className="relative shrink-0 overflow-hidden bg-white shadow-[0_0_0_1px_rgba(18,18,18,0.04),0_8px_16px_-12px_rgba(0,0,0,0.13),0_24px_48px_-24px_rgba(0,0,0,0.12)]"
                role="application"
                style={{ height: canvasHeight, width: canvasWidth }}
              >
                <ClientSlideRenderer
                  editingElementId={tableChoices ? null : editingTextId}
                  interactive
                  logicalHeight={presentationHeight}
                  logicalWidth={presentationWidth}
                  onCanvasPointerDown={clearSelection}
                  onAgendaEdit={() => openAgendaEditor(activeSlide.id)}
                  onAgendaSelect={() => selectAgendaGraphic(activeSlide.id)}
                  onTeamEdit={() => openTeamEditor(activeSlide.id)}
                  onTeamSelect={() => selectTeamGraphic(activeSlide.id)}
                  onTableSelect={() => selectTableGraphic(activeSlide.id)}
                  onTimelineEdit={(timelineId) => openTimelineEditor(activeSlide.id, timelineId)}
                  onTimelineSelect={(timelineId) => selectTimelineGraphic(activeSlide.id, timelineId)}
                  onElementsDragEnd={(positions) =>
                    updateElements(
                      activeSlide.id,
                      positions.map(({ elementId, x, y }) => ({
                        elementId,
                        updates: { x, y },
                      })),
                    )
                  }
                  onElementsSelect={selectElements}
                  onElementEdit={startTextEditing}
                  onElementSelect={selectElement}
                  onElementTransformEnd={(elementId, transform) =>
                    updateElement(activeSlide.id, elementId, transform)
                  }
                  scale={zoom}
                  selectedElementIds={selectedElementIds}
                  showLayoutGrid={showLayoutGrid}
                  slide={activeSlide}
                />
                <AgentCanvasHighlight />
                {editingText && tableChoices ? (
                  <TableCellChoices
                    key={editingText.id}
                    element={editingText}
                    choices={tableChoices}
                    scale={zoom}
                    onChoose={(value) => { updateTableCellText(activeSlide.id, editingText.id, value); stopTextEditing(); }}
                    onCustom={() => setPlainTableCellId(editingText.id)}
                    onClose={stopTextEditing}
                    onNavigate={navigateTableCell}
                  />
                ) : editingText && overlayText ? (
                  <TextEditorOverlay
                    element={overlayText}
                    autoSave={!editingText.tableId}
                    onNavigate={editingText.tableId ? navigateTableCell : undefined}
                    key={editingText.id}
                    onCancel={stopTextEditing}
                    onCommit={({ height, text }) => {
                      if (editingText.tableId) updateTableCellText(activeSlide.id, editingText.id, text);
                      else updateElement(activeSlide.id, editingText.id, { height, text });
                    }}
                    onToggleBold={() =>
                      updateElement(activeSlide.id, editingText.id, {
                        fontWeight:
                          editingText.fontWeight === 700 ? 400 : 700,
                      })
                    }
                    onToggleItalic={() =>
                      updateElement(activeSlide.id, editingText.id, {
                        italic: !editingText.italic,
                      })
                    }
                    scale={zoom}
                    selectAllOnFocus={editingTextSelectAll}
                  />
                ) : null}
              </div>
            </ElementContextMenu>
          ) : null}
        </div>
      </div>

      <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
        <TopBar />
        <ImageContextualToolbar />
        <TextContextualToolbar />
      </div>
      <ZoomControls fitScale={fitScale} />
    </main>
  );
}
