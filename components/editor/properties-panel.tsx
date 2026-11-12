"use client";

import { ChartGantt, ListOrdered, Pencil, Play, Trash2, Users } from "lucide-react";
import { useState } from "react";

import { ExportButton } from "@/components/editor/export-button";
import { CardProperties } from "@/components/editor/panels/card-properties";
import { ImageProperties } from "@/components/editor/panels/image-properties";
import {
  canRecolor3dObject,
  Object3dColorProperties,
} from "@/components/editor/panels/object-3d-color-properties";
import { SlideProperties } from "@/components/editor/panels/slide-properties";
import { TableProperties } from "@/components/editor/panels/table-properties";
import { TextBlockProperties } from "@/components/editor/panels/text-block-properties";
import { TextProperties } from "@/components/editor/panels/text-properties";
import { PresentationMode } from "@/components/editor/presentation-mode";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AGENDA_VARIANTS } from "@/lib/agenda/agenda-model";
import { getTeamPeopleCount, TEAM_VARIANTS } from "@/lib/team/team-model";
import { TIMELINE_VARIANTS } from "@/lib/timeline/timeline-model";
import { selectActiveSlide, useEditorStore } from "@/store/editor-store";

export function PropertiesPanel() {
  const activeSlide = useEditorStore(selectActiveSlide);
  const selectedElementIds = useEditorStore(
    (state) => state.selectedElementIds,
  );
  const slides = useEditorStore((state) => state.presentation.slides);
  const selectSlide = useEditorStore((state) => state.selectSlide);
  const stopTextEditing = useEditorStore((state) => state.stopTextEditing);
  const openAgendaEditor = useEditorStore((state) => state.openAgendaEditor);
  const openTeamEditor = useEditorStore((state) => state.openTeamEditor);
  const openTimelineEditor = useEditorStore((state) => state.openTimelineEditor);
  const removeTimeline = useEditorStore((state) => state.removeTimeline);
  const [isPresenting, setIsPresenting] = useState(false);
  const selectedElementId = selectedElementIds[0];
  const selectedElement = activeSlide?.elements.find(
    (element) => element.id === selectedElementId,
  );
  const selectedTextBlock = activeSlide?.textBlocks?.find((block) => block.id === selectedElement?.textBlockId);
  const tableSelected = Boolean(activeSlide?.table && selectedElement?.tableId === activeSlide.table.id);
  const agendaSelected = Boolean(activeSlide?.agenda && selectedElement?.agendaId === activeSlide.agenda.id);
  const teamSelected = Boolean(activeSlide?.team && selectedElement?.teamId === activeSlide.team.id);
  const selectedTimeline = activeSlide?.timelines?.find((timeline) => timeline.id === selectedElement?.timelineId);

  return (
    <aside className="absolute bottom-3 right-3 top-3 z-10 flex w-[280px] flex-col overflow-hidden rounded-[1.25rem] border border-stroke-01 bg-surface-01">
      <div className="flex items-center justify-between border-b border-stroke-01 p-3 pl-4">
        <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-primary">
          Properties
        </h2>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Present"
                disabled={slides.length === 0}
                onClick={() => {
                  stopTextEditing();
                  setIsPresenting(true);
                }}
                size="icon"
              >
                <Play aria-hidden="true" className="size-3.5 fill-current" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Present</TooltipContent>
          </Tooltip>
          <ExportButton />
        </div>
      </div>

      {activeSlide?.table && tableSelected ? <TableProperties key={activeSlide.table.id} slide={activeSlide} /> : null}

      {activeSlide?.agenda && agendaSelected ? (
        <section className="space-y-3 border-b border-stroke-01 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <ListOrdered className="size-4" strokeWidth={1.8} />
            Agenda graphic
          </div>
          <p className="text-[11px] leading-4 text-muted-foreground">
            {AGENDA_VARIANTS.find((variant) => variant.id === activeSlide.agenda?.variant)?.name}
            {" · "}{activeSlide.agenda.items.length} {activeSlide.agenda.items.length === 1 ? "item" : "items"}
          </p>
          <Button className="w-full" onClick={() => openAgendaEditor(activeSlide.id)} variant="outline">
            <Pencil className="size-3.5" strokeWidth={1.8} />
            Edit agenda
          </Button>
          <p className="text-[11px] leading-4 text-muted-foreground">Edit this graphic from the form. Edit slide text directly on the canvas.</p>
        </section>
      ) : null}

      {activeSlide?.team && teamSelected ? (
        <section className="space-y-3 border-b border-stroke-01 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <Users className="size-4" strokeWidth={1.8} />
            Our Team
          </div>
          <p className="text-[11px] leading-4 text-muted-foreground">
            {TEAM_VARIANTS.find((variant) => variant.id === activeSlide.team?.variant)?.name}
            {" · "}{activeSlide.team.groups.length} {activeSlide.team.groups.length === 1 ? "team" : "teams"}
            {" · "}{getTeamPeopleCount(activeSlide.team)} {getTeamPeopleCount(activeSlide.team) === 1 ? "person" : "people"}
          </p>
          <Button className="w-full" onClick={() => openTeamEditor(activeSlide.id)} variant="outline">
            <Pencil className="size-3.5" strokeWidth={1.8} />
            Edit our team
          </Button>
          <p className="text-[11px] leading-4 text-muted-foreground">Edit this graphic from the form. Edit slide text directly on the canvas.</p>
        </section>
      ) : null}

      {activeSlide && selectedTimeline ? (
        <section className="editor-scrollbar max-h-[260px] shrink-0 space-y-3 overflow-y-auto border-b border-stroke-01 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <ChartGantt className="size-4" strokeWidth={1.8} />
            Timeline
          </div>
          {activeSlide.timelines?.filter((timeline) => timeline.id === selectedTimeline.id).map((timeline) => (
            <div className="space-y-2" key={timeline.id}>
              <p className="text-[11px] leading-4 text-muted-foreground">
                {TIMELINE_VARIANTS.find((variant) => variant.id === timeline.variant)?.name}
                {" · "}{timeline.phases.length} {timeline.phases.length === 1 ? "phase" : "phases"}
              </p>
              <div className="flex gap-1.5">
                <Button className="flex-1" onClick={() => openTimelineEditor(activeSlide.id, timeline.id)} variant="outline">
                  <Pencil className="size-3.5" strokeWidth={1.8} />
                  Edit timeline
                </Button>
                {timeline.placement === "component" ? (
                  <Button aria-label="Remove timeline" className="text-muted-foreground hover:text-destructive" onClick={() => removeTimeline(activeSlide.id, timeline.id)} size="icon" variant="ghost">
                    <Trash2 className="size-3.5" strokeWidth={1.8} />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          <p className="text-[11px] leading-4 text-muted-foreground">Edit this graphic from the form. Edit slide text directly on the canvas.</p>
        </section>
      ) : null}

      {activeSlide && selectedElement && selectedElementIds.length === 1 && canRecolor3dObject(selectedElement) ? (
        <Object3dColorProperties element={selectedElement} slideId={activeSlide.id} />
      ) : null}

      {activeSlide && selectedElement?.component ? (
        <CardProperties
          component={selectedElement.component}
          key={selectedElement.component.instanceId}
          selectedElementIds={selectedElementIds}
          slide={activeSlide}
        />
      ) : null}

      {activeSlide && selectedTextBlock ? <TextBlockProperties key={selectedTextBlock.id} block={selectedTextBlock} slide={activeSlide} /> : tableSelected || agendaSelected || teamSelected || selectedTimeline ? null : activeSlide && selectedElement?.type === "text" ? (
        <TextProperties
          element={selectedElement}
          key={selectedElement.id}
          slideId={activeSlide.id}
        />
      ) : activeSlide && selectedElement?.type === "image" ? (
        <ImageProperties
          element={selectedElement}
          key={selectedElement.id}
          slideId={activeSlide.id}
        />
      ) : selectedElement?.component ? null : (
        // The card section above already covers a selected card background.
        <SlideProperties />
      )}

      {isPresenting && activeSlide ? (
        <PresentationMode
          initialSlideId={activeSlide.id}
          onExit={(slideId) => {
            setIsPresenting(false);
            selectSlide(slideId);
          }}
          slides={slides}
        />
      ) : null}
    </aside>
  );
}
