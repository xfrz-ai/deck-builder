import type { Slide } from "@/types/presentation";
import { createFrameElements } from "@/lib/backgrounds/background-themes";
import { duplicateElementWithNewId } from "@/lib/elements/duplicate-element";
import { createUniqueId } from "@/lib/id";
import { cloneAgenda } from "@/lib/agenda/agenda-model";
import { cloneTeam } from "@/lib/team/team-model";
import { cloneTimeline } from "@/lib/timeline/timeline-model";
import { cloneTable } from "@/lib/table/table-model";
import { cloneTextBlock } from "@/lib/text/text-block";

export const DEFAULT_SLIDE_BACKGROUND = "#FFFFFF";

export function createSlide(
  background = DEFAULT_SLIDE_BACKGROUND,
): Slide {
  const id = createUniqueId("slide");
  return {
    id,
    background,
    elements: createFrameElements(id),
  };
}

export function duplicateSlideWithNewIds(slide: Slide): Slide {
  const textBlocks = slide.textBlocks?.map((block) => cloneTextBlock(block, true));
  const textBlockIds = new Map(slide.textBlocks?.map((block, index) => [block.id, textBlocks![index].id]));
  const table = slide.table ? cloneTable(slide.table, true) : undefined;
  const tableColumns = new Map(slide.table?.columns.map((column, index) => [column.id, table!.columns[index].id]));
  const tableRows = new Map(slide.table?.rows.map((row, index) => [row.id, table!.rows[index].id]));
  const tableGroups = new Map(slide.table?.groups.map((group, index) => [group.id, table!.groups[index].id]));
  const agenda = slide.agenda ? cloneAgenda(slide.agenda, true) : undefined;
  const team = slide.team ? cloneTeam(slide.team, true) : undefined;
  const timelines = slide.timelines?.map((timeline) => cloneTimeline(timeline, true));
  const timelineIds = new Map(slide.timelines?.map((timeline, index) => [timeline.id, timelines![index].id]));
  return {
    ...slide,
    id: createUniqueId("slide"),
    agenda,
    team,
    timelines,
    table,
    textBlocks,
    elements: slide.elements.map((element) => ({
      ...duplicateElementWithNewId(element, 0),
      ...(element.textBlockId ? { textBlockId: textBlockIds.get(element.textBlockId) } : {}),
      ...(element.tableId ? {
        tableId: table?.id,
        tableCell: element.tableCell ? {
          ...element.tableCell,
          columnId: tableColumns.get(element.tableCell.columnId)!,
          rowId: element.tableCell.rowId ? tableRows.get(element.tableCell.rowId) : undefined,
          groupId: element.tableCell.groupId ? tableGroups.get(element.tableCell.groupId) : undefined,
        } : undefined,
      } : {}),
      ...(element.agendaId ? { agendaId: agenda?.id } : {}),
      ...(element.teamId ? { teamId: team?.id } : {}),
      ...(element.timelineId ? { timelineId: timelineIds.get(element.timelineId) } : {}),
    })),
  };
}

export function moveSlide<T>(items: T[], oldIndex: number, newIndex: number) {
  if (
    oldIndex === newIndex ||
    oldIndex < 0 ||
    newIndex < 0 ||
    oldIndex >= items.length ||
    newIndex >= items.length
  ) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(oldIndex, 1);

  if (movedItem === undefined) {
    return items;
  }

  nextItems.splice(newIndex, 0, movedItem);
  return nextItems;
}

export function isSolidHexColor(color: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}
