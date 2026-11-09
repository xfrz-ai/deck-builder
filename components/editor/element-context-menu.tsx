"use client";

import { Copy, Pencil, Trash2 } from "lucide-react";
import type { ReactElement } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { selectActiveSlide, useEditorStore } from "@/store/editor-store";

export function ElementContextMenu({ children }: { children: ReactElement }) {
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const activeSlide = useEditorStore(selectActiveSlide);
  const selectedElementIds = useEditorStore(
    (state) => state.selectedElementIds,
  );
  const selectedElementId = selectedElementIds[0];
  const agendaSelected = Boolean(activeSlide?.agenda && activeSlide.elements.some((element) =>
    element.id === selectedElementId && element.agendaId === activeSlide.agenda?.id,
  ));
  const teamSelected = Boolean(activeSlide?.team && activeSlide.elements.some((element) =>
    element.id === selectedElementId && element.teamId === activeSlide.team?.id,
  ));
  const tableSelected = Boolean(activeSlide?.table && activeSlide.elements.some((element) => element.id === selectedElementId && element.tableId === activeSlide.table?.id));
  const selectTableGraphic = useEditorStore((state) => state.selectTableGraphic);
  const openAgendaEditor = useEditorStore((state) => state.openAgendaEditor);
  const openTeamEditor = useEditorStore((state) => state.openTeamEditor);
  const selectedTimeline = activeSlide?.timelines?.find((timeline) => activeSlide.elements.some((element) =>
    element.id === selectedElementId && element.timelineId === timeline.id,
  ));
  const openTimelineEditor = useEditorStore((state) => state.openTimelineEditor);
  const duplicateElement = useEditorStore(
    (state) => state.duplicateElement,
  );
  const deleteElements = useEditorStore((state) => state.deleteElements);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent aria-label="Element actions">
        {tableSelected ? (
          <ContextMenuItem onSelect={() => {
            selectTableGraphic(activeSlideId);
            requestAnimationFrame(() => document.getElementById("table-rows")?.focus());
          }}>
            <Pencil className="size-3.5" strokeWidth={1.8} />Edit table structure
          </ContextMenuItem>
        ) : agendaSelected ? (
          <ContextMenuItem onSelect={() => openAgendaEditor(activeSlideId)}>
            <Pencil className="size-3.5" strokeWidth={1.8} />
            Edit agenda
          </ContextMenuItem>
        ) : teamSelected ? (
          <ContextMenuItem onSelect={() => openTeamEditor(activeSlideId)}>
            <Pencil className="size-3.5" strokeWidth={1.8} />
            Edit our team
          </ContextMenuItem>
        ) : selectedTimeline ? (
          <ContextMenuItem onSelect={() => openTimelineEditor(activeSlideId, selectedTimeline.id)}>
            <Pencil className="size-3.5" strokeWidth={1.8} />
            Edit timeline
          </ContextMenuItem>
        ) : (
          <>
        <ContextMenuItem
          disabled={!selectedElementId}
          onSelect={() => {
            if (selectedElementId) {
              duplicateElement(activeSlideId, selectedElementId);
            }
          }}
        >
          <Copy className="size-3.5" strokeWidth={1.8} />
          Duplicate
          <span className="ml-auto text-[10px] text-muted-foreground">
            ⌘/Ctrl D
          </span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="focus:bg-red-50 focus:text-red-700"
          disabled={!selectedElementId}
          onSelect={() => {
            deleteElements(activeSlideId, selectedElementIds);
          }}
        >
          <Trash2 className="size-3.5" strokeWidth={1.8} />
          Delete
        </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
