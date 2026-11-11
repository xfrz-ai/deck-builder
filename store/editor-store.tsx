"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  createAgendaSlide,
  getAgendaErrors,
  type MeasureAgendaText,
} from "@/lib/agenda/agenda-elements";
import { detachAgendaStaticElements, getAgendaGraphicSelectionId, normalizeAgendaPresentation } from "@/lib/agenda/agenda-ownership";
import {
  cloneAgenda,
  isAgendaData,
} from "@/lib/agenda/agenda-model";
import { createUniqueId } from "@/lib/id";
import type { AgendaData, AgendaEditorSession } from "@/types/agenda";
import {
  createTeamSlide,
  getTeamErrors,
  type MeasureTeamText,
} from "@/lib/team/team-elements";
import {
  cloneTeam,
  isTeamData,
} from "@/lib/team/team-model";
import { detachTeamStaticElements, getTeamGraphicSelectionId, normalizeTeamPresentation } from "@/lib/team/team-ownership";
import type { TeamData, TeamEditorSession } from "@/types/team";
import {
  createDynamicTimelineSlide,
  getDynamicTimelineErrors,
  type MeasureTimelineText,
} from "@/lib/timeline/timeline-component-elements";
import { detachTimelineStaticElements, getTimelineGraphicSelectionId, normalizeTimelinePresentation } from "@/lib/timeline/timeline-ownership";
import { todayDateInput } from "@/lib/timeline/timeline-dates";
import { cloneTimeline, createDefaultTimeline, isTimelineData } from "@/lib/timeline/timeline-model";
import type { TimelineData, TimelineEditorSession } from "@/types/timeline";
import { getTableCellOrder, getTableSelectionId, updateTableSlide } from "@/lib/table/table-elements";
import { getTableCellText, isTableData, resizeTable, setTableCellText } from "@/lib/table/table-model";
import { normalizeTablePresentation } from "@/lib/table/table-migration";
import { cloneTextBlock, createTextBlock, isTextBlockData, reflowTextBlockPresentation, textBlocksFromElements, updateTextBlockLayout, updateTextBlockPart, upsertTextBlock } from "@/lib/text/text-block";
import type { TextBlockLayoutUpdates, TextBlockTemplate } from "@/types/text-block";


import {
  applyThemeToSlide,
  reconcileSlideTheme,
} from "@/lib/themes/apply-theme";
import type { ThemeId } from "@/lib/themes/deck-themes";
import {
  clampZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  roundZoom,
  ZOOM_STEP,
} from "@/lib/canvas/zoom";
import { createDefaultPresentation } from "@/lib/presentation/default-presentation";
import {
  createDebouncedLocalStorage,
  EDITOR_STORAGE_KEY,
  EDITOR_STORAGE_VERSION,
  normalizePersistedEditorState,
  type PersistedEditorState,
} from "@/lib/presentation/persistence";
import {
  createSlide,
  duplicateSlideWithNewIds,
  isSolidHexColor,
  moveSlide,
} from "@/lib/slides/slide-utils";
import { removeOrphanedCardParts } from "@/lib/elements/card-component";
import { duplicateElementWithNewId } from "@/lib/elements/duplicate-element";
import { applyDarkModeToElement } from "@/lib/slides/dark-mode";
import {
  createSlideFromLayout,
  type SlideLayoutId,
} from "@/lib/layouts/layout-registry";
import type {
  ImageElement,
  Presentation,
  ShapeElement,
  Slide,
  SlideElement,
  TextElement,
} from "@/types/presentation";

export type ZoomMode = "fit" | "custom";

interface EditorDocumentState {
  presentation: Presentation;
}

interface EditorViewState {
  agendaEditor: AgendaEditorSession | null;
  teamEditor: TeamEditorSession | null;
  timelineEditor: TimelineEditorSession | null;
  activeSlideId: string;
  editingTextId: string | null;
  editingTextSelectAll: boolean;
  selectedElementIds: string[];
  // Editor-only overlay of the 24×12 layout grid; never saved.
  showLayoutGrid: boolean;
  zoom: number;
  zoomMode: ZoomMode;
}

interface EditorHistoryEntry {
  activeSlideId: string;
  presentation: Presentation;
}

interface EditorHistoryState {
  redoStack: EditorHistoryEntry[];
  undoStack: EditorHistoryEntry[];
}

interface EditorActions {
  insertTextBlock: (slideId: string, template: TextBlockTemplate) => void;
  updateTextBlockLayout: (slideId: string, blockId: string, updates: TextBlockLayoutUpdates) => void;
  reflowTextBlocks: () => void;
  selectAgendaGraphic: (slideId: string) => void;
  openAgendaEditor: (slideId: string) => void;
  closeAgendaEditor: () => void;
  saveAgenda: (data: AgendaData, measure: MeasureAgendaText) => void;
  // Applies agenda data from outside the form (the AI chat), as one undo step.
  applyAgendaData: (slideId: string, data: AgendaData, measure: MeasureAgendaText) => void;
  selectTeamGraphic: (slideId: string) => void;
  openTeamEditor: (slideId: string) => void;
  closeTeamEditor: () => void;
  saveTeam: (data: TeamData, measure: MeasureTeamText) => void;
  // Applies team data from outside the form (the AI chat), as one undo step.
  applyTeamData: (slideId: string, data: TeamData, measure: MeasureTeamText) => void;
  beginInsertTimeline: (slideId: string) => void;
  selectTimelineGraphic: (slideId: string, timelineId: string) => void;
  openTimelineEditor: (slideId: string, timelineId: string) => void;
  closeTimelineEditor: () => void;
  saveTimeline: (data: TimelineData, measure: MeasureTimelineText) => void;
  // Applies an existing timeline's data from outside the form (the AI chat).
  applyTimelineData: (slideId: string, data: TimelineData, measure: MeasureTimelineText) => void;
  removeTimeline: (slideId: string, timelineId: string) => void;
  selectTableGraphic: (slideId: string) => void;
  resizeSlideTable: (slideId: string, rows: number, columns: number) => void;
  setTableHighlight: (slideId: string, columnId: string | undefined) => void;
  updateTableCellText: (slideId: string, elementId: string, text: string) => void;
  navigateTableCell: (direction: -1 | 1) => void;
  addElement: (slideId: string, element: SlideElement) => void;
  addElements: (slideId: string, elements: readonly SlideElement[]) => void;
  addLayoutSlide: (layoutId: SlideLayoutId) => void;
  addSlide: () => void;
  // Replaces the deck, or appends its slides, as one undo step.
  importDeck: (presentation: Presentation, mode: "replace" | "append") => void;
  clearSelection: () => void;
  deleteElement: (slideId: string, elementId: string) => void;
  deleteElements: (slideId: string, elementIds: readonly string[]) => void;
  deleteSlide: (slideId: string) => void;
  duplicateElement: (slideId: string, elementId: string) => void;
  duplicateSlide: (slideId: string) => void;
  reorderSlides: (oldIndex: number, newIndex: number) => void;
  selectAllElements: () => void;
  selectElement: (elementId: string, additive?: boolean) => void;
  selectElements: (elementIds: readonly string[]) => void;
  selectSlide: (slideId: string) => void;
  redo: () => void;
  setSlideTheme: (slideId: string, themeId: ThemeId) => void;
  applyThemeToAllSlides: (themeId: ThemeId) => void;
  updatePresentationTitle: (title: string) => void;
  updateSlide: (
    slideId: string,
    updates: Partial<Omit<Slide, "id">>,
  ) => void;
  updateSlideBackground: (slideId: string, color: string) => void;
  updateElement: (
    slideId: string,
    elementId: string,
    updates: ElementUpdates,
  ) => void;
  updateElements: (
    slideId: string,
    updates: readonly ElementUpdate[],
  ) => void;
  undo: () => void;
  setZoom: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToWorkspace: (scale: number) => void;
  startTextEditing: (elementId: string) => void;
  stopTextEditing: () => void;
  toggleLayoutGrid: () => void;
}

type ElementUpdates =
  | Partial<Omit<ShapeElement, "id" | "type">>
  | Partial<Omit<TextElement, "id" | "type">>
  | Partial<Omit<ImageElement, "id" | "type">>;

interface ElementUpdate {
  elementId: string;
  updates: ElementUpdates;
}

function expandTextBlockSelection(slide: Slide, ids: readonly string[]) {
  const requested = new Set(ids);
  const blockIds = new Set(slide.elements.flatMap((element) => requested.has(element.id) && element.textBlockId ? [element.textBlockId] : []));
  return slide.elements.filter((element) => requested.has(element.id) || (element.textBlockId && blockIds.has(element.textBlockId))).map((element) => element.id);
}

function applySlideElementUpdates(slide: Slide, updates: readonly ElementUpdate[]): Slide {
  let next = slide;
  for (const block of slide.textBlocks ?? []) {
    let data = block;
    let translated = false;
    for (const entry of updates) {
      const element = slide.elements.find((element) => element.id === entry.elementId && element.textBlockId === block.id);
      if (element?.type !== "text" || !element.textBlockPart) continue;
      const value = entry.updates;
      if (!translated && ((typeof value.x === "number" && Number.isFinite(value.x)) || (typeof value.y === "number" && Number.isFinite(value.y)))) {
        data = updateTextBlockLayout(data, {
          x: block.x + (typeof value.x === "number" ? value.x - element.x : 0),
          y: block.y + (typeof value.y === "number" ? value.y - element.y : 0),
        });
        translated = true;
      }
      data = updateTextBlockPart(data, element.textBlockPart, value as Partial<TextElement>);
    }
    if (JSON.stringify(data) !== JSON.stringify(block) && isTextBlockData(data)) next = upsertTextBlock(next, data);
  }
  const updateMap = new Map(updates.map((entry) => [entry.elementId, entry.updates]));
  let changed = false;
  const elements = next.elements.map((element) => {
    const value = updateMap.get(element.id);
    if (!value || element.textBlockId || element.agendaId || element.teamId || element.timelineId || element.tableId) return element;
    if (!Object.entries(value).some(([key, value]) => element[key as keyof SlideElement] !== value)) return element;
    changed = true; return { ...element, ...value } as SlideElement;
  });
  return changed ? { ...next, elements } : next;
}

export type EditorStore = EditorDocumentState &
  EditorViewState &
  EditorHistoryState &
  EditorActions;

const HISTORY_LIMIT = 100;

function withDocumentHistory(
  state: EditorStore,
  changes: Partial<EditorStore>,
): Partial<EditorStore> {
  if (
    changes.presentation === undefined ||
    changes.presentation === state.presentation
  ) {
    return changes;
  }

  // Elements added to a themed slide (inserted, pasted or regenerated from a
  // form) pick up the slide's theme.
  const previousSlides = new Set(state.presentation.slides);
  let didReconcile = false;
  const slides = changes.presentation.slides.map((slide) => {
    if (previousSlides.has(slide) || !slide.themeId) return slide;
    const reconciled = reconcileSlideTheme(slide);
    didReconcile ||= reconciled !== slide;
    return reconciled;
  });
  if (didReconcile) {
    changes = { ...changes, presentation: { ...changes.presentation, slides } };
  }

  const undoStack = [
    ...state.undoStack,
    {
      activeSlideId: state.activeSlideId,
      presentation: state.presentation,
    },
  ].slice(-HISTORY_LIMIT);

  return {
    ...changes,
    undoStack,
    redoStack: [],
  };
}

function deleteSlideElements(state: EditorStore, slideId: string, ids: readonly string[]) {
  const slide = state.presentation.slides.find((slide) => slide.id === slideId);
  if (!slide) return state;
  const requested = new Set(expandTextBlockSelection(slide, ids));
  const elements = slide.elements.filter((element) => !requested.has(element.id) || Boolean(element.agendaId || element.teamId || element.timelineId || element.tableId));
  if (elements.length === slide.elements.length) return state;
  const next: Slide = {
    ...slide, elements: removeOrphanedCardParts(elements),
    textBlocks: slide.textBlocks?.filter((block) => elements.some((element) => element.textBlockId === block.id)),
  };
  const deletedIds = new Set(slide.elements.filter((element) => !elements.includes(element)).map((element) => element.id));
  const editingDeleted = Boolean(state.editingTextId && deletedIds.has(state.editingTextId));
  return withDocumentHistory(state, {
    presentation: { ...state.presentation, slides: state.presentation.slides.map((item) => item.id === slideId ? next : item) },
    selectedElementIds: state.selectedElementIds.filter((id) => !deletedIds.has(id)),
    editingTextId: editingDeleted ? null : state.editingTextId,
    editingTextSelectAll: editingDeleted ? false : state.editingTextSelectAll,
  });
}

export const selectActiveSlide = (state: EditorStore) =>
  state.presentation.slides.find(
    (slide) => slide.id === state.activeSlideId,
  ) ?? state.presentation.slides[0];

export function createEditorStore(
  initialPresentation = createDefaultPresentation(),
) {
  initialPresentation = reflowTextBlockPresentation(normalizeTablePresentation(normalizeTimelinePresentation(normalizeTeamPresentation(normalizeAgendaPresentation(initialPresentation)))));
  return createStore<EditorStore>()(
    persist(
      (set) => ({
        presentation: initialPresentation,
        agendaEditor: null,
        teamEditor: null,
        timelineEditor: null,
        activeSlideId: initialPresentation.slides[0]?.id ?? "",
        editingTextId: null,
        editingTextSelectAll: false,
        selectedElementIds: [],
        zoom: 1,
        zoomMode: "fit",
        showLayoutGrid: false,
        undoStack: [],
        redoStack: [],
        insertTextBlock: (slideId, template) =>
          set((state) => {
            const previous = state.presentation.slides.find((slide) => slide.id === slideId);
            if (!previous) return state;
            const data = createTextBlock(template, Boolean(previous.darkMode));
            const offset = Math.min((previous.textBlocks?.length ?? 0) * 24, 144);
            data.x += offset; data.y += offset;
            const slide = upsertTextBlock(previous, data);
            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides: state.presentation.slides.map((item) => item.id === slideId ? slide : item) },
              selectedElementIds: slide.elements.filter((element) => element.textBlockId === data.id).map((element) => element.id),
              editingTextId: null, editingTextSelectAll: false,
            });
          }),
        updateTextBlockLayout: (slideId, blockId, updates) =>
          set((state) => {
            const previous = state.presentation.slides.find((slide) => slide.id === slideId);
            const old = previous?.textBlocks?.find((block) => block.id === blockId);
            if (!previous || !old) return state;
            const data = updateTextBlockLayout(old, updates);
            if (!isTextBlockData(data) || JSON.stringify(data) === JSON.stringify(old)) return state;
            const slide = upsertTextBlock(previous, data);
            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides: state.presentation.slides.map((item) => item.id === slideId ? slide : item) },
              editingTextId: null, editingTextSelectAll: false,
            });
          }),
        reflowTextBlocks: () => set((state) => {
          const presentation = reflowTextBlockPresentation(state.presentation);
          return presentation === state.presentation ? state : { presentation };
        }),
        selectTableGraphic: (slideId) =>
          set((state) => {
            const slide = state.presentation.slides.find((slide) => slide.id === slideId);
            const id = slide ? getTableSelectionId(slide) : undefined;
            return slideId === state.activeSlideId && id ? { editingTextId: null, editingTextSelectAll: false, selectedElementIds: [id] } : state;
          }),
        resizeSlideTable: (slideId, rows, columns) =>
          set((state) => {
            const previous = state.presentation.slides.find((slide) => slide.id === slideId);
            if (!previous?.table || !Number.isInteger(rows) || !Number.isInteger(columns)) return state;
            const table = resizeTable(previous.table, rows, columns);
            if (!isTableData(table) || (table.rowCount === previous.table.rowCount && table.columnCount === previous.table.columnCount)) return state;
            const slide = updateTableSlide(previous, table);
            const id = getTableSelectionId(slide);
            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides: state.presentation.slides.map((item) => item.id === slideId ? slide : item) },
              editingTextId: null, editingTextSelectAll: false, selectedElementIds: id ? [id] : [],
            });
          }),
        setTableHighlight: (slideId, columnId) =>
          set((state) => {
            const previous = state.presentation.slides.find((slide) => slide.id === slideId);
            if (!previous?.table || previous.table.variant !== "packages" || previous.table.highlightedColumnId === columnId ||
              (columnId && !previous.table.columns.slice(1, previous.table.columnCount).some((column) => column.id === columnId))) return state;
            const slide = updateTableSlide(previous, { ...previous.table, highlightedColumnId: columnId });
            const id = getTableSelectionId(slide);
            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides: state.presentation.slides.map((item) => item.id === slideId ? slide : item) },
              editingTextId: null, editingTextSelectAll: false, selectedElementIds: id ? [id] : [],
            });
          }),
        updateTableCellText: (slideId, elementId, text) =>
          set((state) => {
            const previous = state.presentation.slides.find((slide) => slide.id === slideId);
            const element = previous?.elements.find((element) => element.id === elementId);
            if (!previous?.table || !element?.tableCell || element.tableId !== previous.table.id || getTableCellText(previous.table, element.tableCell) === text) return state;
            const slide = updateTableSlide(previous, setTableCellText(previous.table, element.tableCell, text));
            const ref = element.tableCell;
            const replacement = slide.elements.find((item) => item.type === "text" && item.tableCell && item.tableCell.columnId === ref.columnId && item.tableCell.rowId === ref.rowId && item.tableCell.groupId === ref.groupId && item.tableCell.field === ref.field);
            const selection = getTableSelectionId(slide);
            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides: state.presentation.slides.map((item) => item.id === slideId ? slide : item) },
              editingTextId: state.editingTextId === elementId ? replacement?.id ?? null : state.editingTextId,
              ...(state.activeSlideId === slideId && previous.elements.some((item) => item.tableId === previous.table?.id && state.selectedElementIds.includes(item.id)) ? {
                selectedElementIds: selection ? [selection] : [],
              } : {}),
            });
          }),
        navigateTableCell: (direction) =>
          set((state) => {
            const slide = state.presentation.slides.find((slide) => slide.id === state.activeSlideId);
            if (!slide?.table || !state.editingTextId) return state;
            const ids = getTableCellOrder(slide);
            const index = ids.indexOf(state.editingTextId);
            const id = index >= 0 ? ids[index + direction] : undefined;
            return { editingTextId: id ?? null, editingTextSelectAll: Boolean(id) };
          }),
        selectAgendaGraphic: (slideId) =>
          set((state) => {
            if (slideId !== state.activeSlideId) return state;
            const original = state.presentation.slides.find((item) => item.id === slideId);
            const slide = original ? detachAgendaStaticElements(original) : undefined;
            const elementId = slide ? getAgendaGraphicSelectionId(slide) : undefined;
            if (!slide || !elementId) return state;
            return {
              ...(slide !== original ? {
                presentation: { ...state.presentation, slides: state.presentation.slides.map((item) => item.id === slideId ? slide : item) },
              } : {}),
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: [elementId],
            };
          }),
        openAgendaEditor: (slideId) =>
          set((state) => {
            const original = state.presentation.slides.find((item) => item.id === slideId);
            const slide = original ? detachAgendaStaticElements(original) : undefined;
            const elementId = slide ? getAgendaGraphicSelectionId(slide) : undefined;
            return slide?.agenda ? {
              ...(slide !== original ? {
                presentation: { ...state.presentation, slides: state.presentation.slides.map((item) => item.id === slideId ? slide : item) },
              } : {}),
              agendaEditor: { slideId, initialData: cloneAgenda(slide.agenda) },
              teamEditor: null,
              timelineEditor: null,
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: elementId ? [elementId] : [],
            } : state;
          }),
        closeAgendaEditor: () => set({ agendaEditor: null }),
        saveAgenda: (data, measure) =>
          set((state) => {
            const session = state.agendaEditor;
            if (!session || !isAgendaData(data) || Object.keys(getAgendaErrors(data, measure)).length > 0) return state;
            const previous = state.presentation.slides.find((slide) => slide.id === session.slideId);
            if (!previous?.agenda || previous.agenda.id !== data.id || previous.agenda.variant !== data.variant) return state;
            const slide = createAgendaSlide(cloneAgenda(data), previous.id, measure, previous);
            const slides = state.presentation.slides.map((item) => item.id === slide.id ? slide : item);
            const elementId = getAgendaGraphicSelectionId(slide);
            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides },
              activeSlideId: slide.id,
              agendaEditor: null,
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: elementId ? [elementId] : [],
            });
          }),
        applyAgendaData: (slideId, data, measure) =>
          set((state) => {
            if (!isAgendaData(data) || Object.keys(getAgendaErrors(data, measure)).length > 0) return state;
            const previous = state.presentation.slides.find((slide) => slide.id === slideId);
            if (!previous?.agenda || previous.agenda.id !== data.id || previous.agenda.variant !== data.variant) return state;
            const slide = createAgendaSlide(cloneAgenda(data), previous.id, measure, previous);
            const slides = state.presentation.slides.map((item) => item.id === slide.id ? slide : item);
            const elementId = getAgendaGraphicSelectionId(slide);
            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides },
              activeSlideId: slide.id,
              agendaEditor: null,
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: elementId ? [elementId] : [],
            });
          }),
        selectTeamGraphic: (slideId) =>
          set((state) => {
            if (slideId !== state.activeSlideId) return state;
            const original = state.presentation.slides.find((item) => item.id === slideId);
            const slide = original ? detachTeamStaticElements(original) : undefined;
            const elementId = slide ? getTeamGraphicSelectionId(slide) : undefined;
            if (!slide || !elementId) return state;
            return {
              ...(slide !== original ? {
                presentation: { ...state.presentation, slides: state.presentation.slides.map((item) => item.id === slideId ? slide : item) },
              } : {}),
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: [elementId],
            };
          }),
        openTeamEditor: (slideId) =>
          set((state) => {
            const original = state.presentation.slides.find((item) => item.id === slideId);
            const slide = original ? detachTeamStaticElements(original) : undefined;
            const elementId = slide ? getTeamGraphicSelectionId(slide) : undefined;
            return slide?.team ? {
              ...(slide !== original ? {
                presentation: { ...state.presentation, slides: state.presentation.slides.map((item) => item.id === slideId ? slide : item) },
              } : {}),
              teamEditor: { slideId, initialData: cloneTeam(slide.team) },
              agendaEditor: null,
              timelineEditor: null,
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: elementId ? [elementId] : [],
            } : state;
          }),
        closeTeamEditor: () => set({ teamEditor: null }),
        saveTeam: (data, measure) =>
          set((state) => {
            const session = state.teamEditor;
            if (!session || !isTeamData(data) || Object.keys(getTeamErrors(data, measure)).length > 0) return state;
            const previous = state.presentation.slides.find((slide) => slide.id === session.slideId);
            if (!previous?.team || previous.team.id !== data.id || previous.team.variant !== data.variant) return state;
            const slide = createTeamSlide(cloneTeam(data), previous.id, measure, previous);
            const slides = state.presentation.slides.map((item) => item.id === slide.id ? slide : item);
            const elementId = getTeamGraphicSelectionId(slide);
            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides },
              activeSlideId: slide.id,
              teamEditor: null,
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: elementId ? [elementId] : [],
            });
          }),
        applyTeamData: (slideId, data, measure) =>
          set((state) => {
            if (!isTeamData(data) || Object.keys(getTeamErrors(data, measure)).length > 0) return state;
            const previous = state.presentation.slides.find((slide) => slide.id === slideId);
            if (!previous?.team || previous.team.id !== data.id || previous.team.variant !== data.variant) return state;
            const slide = createTeamSlide(cloneTeam(data), previous.id, measure, previous);
            const slides = state.presentation.slides.map((item) => item.id === slide.id ? slide : item);
            const elementId = getTeamGraphicSelectionId(slide);
            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides },
              activeSlideId: slide.id,
              teamEditor: null,
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: elementId ? [elementId] : [],
            });
          }),
        beginInsertTimeline: (slideId) =>
          set((state) => {
            if (!state.presentation.slides.some((slide) => slide.id === slideId)) return state;
            return {
              timelineEditor: {
                slideId,
                timelineId: null,
                initialData: createDefaultTimeline("bars", createUniqueId("component"), todayDateInput()),
              },
              agendaEditor: null,
              teamEditor: null,
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: [],
            };
          }),
        selectTimelineGraphic: (slideId, timelineId) =>
          set((state) => {
            if (slideId !== state.activeSlideId) return state;
            const original = state.presentation.slides.find((item) => item.id === slideId);
            const slide = original ? detachTimelineStaticElements(original) : undefined;
            const elementId = slide ? getTimelineGraphicSelectionId(slide, timelineId) : undefined;
            if (!slide || !elementId) return state;
            return {
              ...(slide !== original ? {
                presentation: { ...state.presentation, slides: state.presentation.slides.map((item) => item.id === slideId ? slide : item) },
              } : {}),
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: [elementId],
            };
          }),
        openTimelineEditor: (slideId, timelineId) =>
          set((state) => {
            const original = state.presentation.slides.find((item) => item.id === slideId);
            const slide = original ? detachTimelineStaticElements(original) : undefined;
            const timeline = slide?.timelines?.find((item) => item.id === timelineId);
            const elementId = slide ? getTimelineGraphicSelectionId(slide, timelineId) : undefined;
            if (!slide || !timeline) return state;
            return {
              ...(slide !== original ? {
                presentation: { ...state.presentation, slides: state.presentation.slides.map((item) => item.id === slideId ? slide : item) },
              } : {}),
              timelineEditor: { slideId, timelineId, initialData: cloneTimeline(timeline) },
              agendaEditor: null,
              teamEditor: null,
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: elementId ? [elementId] : [],
            };
          }),
        closeTimelineEditor: () => set({ timelineEditor: null }),
        saveTimeline: (data, measure) =>
          set((state) => {
            const session = state.timelineEditor;
            if (!session || !isTimelineData(data) || data.id !== session.initialData.id || data.placement !== session.initialData.placement || data.variant !== session.initialData.variant || Object.keys(getDynamicTimelineErrors(data, measure)).length > 0) return state;
            const previous = state.presentation.slides.find((slide) => slide.id === session.slideId);
            if (!previous) return state;
            const existing = previous.timelines?.find((timeline) => timeline.id === session.timelineId);
            if (session.timelineId) {
              if (!existing || existing.id !== data.id || existing.variant !== data.variant || existing.placement !== data.placement) return state;
            } else if (data.placement !== "component" || previous.timelines?.some((timeline) => timeline.id === data.id)) return state;
            const slide = createDynamicTimelineSlide(cloneTimeline(data), previous.id, measure, previous);
            const slides = state.presentation.slides.map((item) => item.id === slide.id ? slide : item);
            const elementId = getTimelineGraphicSelectionId(slide, data.id);
            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides },
              activeSlideId: slide.id,
              timelineEditor: null,
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: elementId ? [elementId] : [],
            });
          }),
        applyTimelineData: (slideId, data, measure) =>
          set((state) => {
            if (!isTimelineData(data) || Object.keys(getDynamicTimelineErrors(data, measure)).length > 0) return state;
            const previous = state.presentation.slides.find((slide) => slide.id === slideId);
            const existing = previous?.timelines?.find((timeline) => timeline.id === data.id);
            if (!previous || !existing || existing.variant !== data.variant || existing.placement !== data.placement) return state;
            const slide = createDynamicTimelineSlide(cloneTimeline(data), previous.id, measure, previous);
            const slides = state.presentation.slides.map((item) => item.id === slide.id ? slide : item);
            const elementId = getTimelineGraphicSelectionId(slide, data.id);
            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides },
              activeSlideId: slide.id,
              timelineEditor: null,
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: elementId ? [elementId] : [],
            });
          }),
        removeTimeline: (slideId, timelineId) =>
          set((state) => {
            const slide = state.presentation.slides.find((item) => item.id === slideId);
            if (!slide?.timelines?.some((timeline) => timeline.id === timelineId && timeline.placement === "component")) return state;
            return withDocumentHistory(state, {
              presentation: {
                ...state.presentation,
                slides: state.presentation.slides.map((item) => item.id === slideId ? {
                  ...item,
                  timelines: item.timelines?.filter((timeline) => timeline.id !== timelineId),
                  elements: item.elements.filter((element) => element.timelineId !== timelineId),
                } : item),
              },
              selectedElementIds: [],
              editingTextId: null,
              editingTextSelectAll: false,
              timelineEditor: state.timelineEditor?.timelineId === timelineId ? null : state.timelineEditor,
            });
          }),
        addElement: (slideId, element) =>
          set((state) => {
            const slideIndex = state.presentation.slides.findIndex(
              (slide) => slide.id === slideId,
            );

            if (slideIndex < 0) {
              return state;
            }

            const slides = [...state.presentation.slides];
            const slide = slides[slideIndex];
            slides[slideIndex] = {
              ...slide,
              elements: [
                ...slide.elements,
                slide.darkMode
                  ? applyDarkModeToElement(element, true)
                  : element,
              ],
            };

            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides },
              editingTextId: element.type === "text" ? element.id : null,
              editingTextSelectAll: element.type === "text",
              selectedElementIds: [element.id],
            });
          }),
        addElements: (slideId, elements) =>
          set((state) => {
            const slideIndex = state.presentation.slides.findIndex(
              (slide) => slide.id === slideId,
            );

            if (slideIndex < 0 || elements.length === 0) {
              return state;
            }

            const slides = [...state.presentation.slides];
            const slide = slides[slideIndex];
            const addedElements = slide.darkMode
              ? elements.map((element) => applyDarkModeToElement(element, true))
              : elements;
            let updated: Slide = { ...slide, elements: [...slide.elements, ...addedElements] };
            for (const block of textBlocksFromElements(addedElements)) {
              if (isTextBlockData(block)) updated = upsertTextBlock(updated, block);
            }
            slides[slideIndex] = updated;

            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides },
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: addedElements.map((element) => element.id),
            });
          }),
        addSlide: () =>
          set((state) => {
            const slide = createSlide();
            const activeIndex = state.presentation.slides.findIndex(
              (item) => item.id === state.activeSlideId,
            );
            const insertIndex =
              activeIndex >= 0
                ? activeIndex + 1
                : state.presentation.slides.length;
            const slides = [...state.presentation.slides];
            slides.splice(insertIndex, 0, slide);

            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides },
              activeSlideId: slide.id,
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: [],
            });
          }),
        importDeck: (presentation, mode) =>
          set((state) => {
            const first = presentation.slides[0];
            if (!first) return state;
            return withDocumentHistory(state, {
              presentation: mode === "replace"
                ? { ...state.presentation, title: presentation.title, slides: presentation.slides }
                : { ...state.presentation, slides: [...state.presentation.slides, ...presentation.slides] },
              activeSlideId: first.id,
              agendaEditor: null,
              teamEditor: null,
              timelineEditor: null,
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: [],
            });
          }),
        addLayoutSlide: (layoutId) =>
          set((state) => {
            const slide = createSlideFromLayout(layoutId);

            if (!slide) {
              return state;
            }

            const activeIndex = state.presentation.slides.findIndex(
              (item) => item.id === state.activeSlideId,
            );
            const insertIndex =
              activeIndex >= 0
                ? activeIndex + 1
                : state.presentation.slides.length;
            const slides = [...state.presentation.slides];
            slides.splice(insertIndex, 0, slide);

            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides },
              activeSlideId: slide.id,
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: [],
            });
          }),
        clearSelection: () =>
          set({
            editingTextId: null,
            editingTextSelectAll: false,
            selectedElementIds: [],
          }),
        selectSlide: (slideId) =>
          set((state) =>
            state.presentation.slides.some((slide) => slide.id === slideId)
              ? {
                  activeSlideId: slideId,
                  editingTextId: null,
                  editingTextSelectAll: false,
                  selectedElementIds: [],
                }
              : state,
          ),
        selectElement: (elementId, additive = false) =>
          set((state) => {
            const activeSlide = state.presentation.slides.find(
              (slide) => slide.id === state.activeSlideId,
            );
            const element = activeSlide?.elements.find(
              (item) => item.id === elementId,
            );

            if (
              !element ||
              element.locked ||
              element.visible === false ||
              element.role === "background"
            ) {
              return state;
            }

            if (element.textBlockId && activeSlide) {
              const group = activeSlide.elements.filter((item) => item.textBlockId === element.textBlockId && item.visible !== false && !item.locked).map((item) => item.id);
              const current = state.selectedElementIds.filter((id) => {
                const item = activeSlide.elements.find((item) => item.id === id);
                return !item?.agendaId && !item?.teamId && !item?.timelineId && !item?.tableId;
              });
              const selected = current.includes(elementId);
              const ids = additive ? selected ? current.filter((id) => !group.includes(id)) : [...current, ...group]
                : [elementId, ...(selected ? current : group).filter((id) => id !== elementId)];
              return { editingTextId: null, editingTextSelectAll: false, selectedElementIds: ids };
            }

            if (additive) {
              const currentIds = state.selectedElementIds.filter((id) => {
                const selected = activeSlide?.elements.find((item) => item.id === id);
                return !selected?.agendaId && !selected?.teamId && !selected?.timelineId && !selected?.tableId;
              });
              const selectedElementIds = currentIds.includes(
                elementId,
              )
                ? currentIds.filter((id) => id !== elementId)
                : [...currentIds, elementId];

              return {
                editingTextId: null,
                editingTextSelectAll: false,
                selectedElementIds,
              };
            }

            if (state.selectedElementIds.includes(elementId)) {
              return state;
            }

            return {
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: [elementId],
            };
          }),
        selectElements: (elementIds) =>
          set((state) => {
            const activeSlide = state.presentation.slides.find(
              (slide) => slide.id === state.activeSlideId,
            );

            if (!activeSlide) {
              return state;
            }

            const requestedIds = new Set(elementIds);
            const selectedElementIds = activeSlide.elements
              .filter(
                (element) =>
                  requestedIds.has(element.id) &&
                  !element.locked &&
                  element.visible !== false &&
                  element.role !== "background",
              )
              .map((element) => element.id);

            return {
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: expandTextBlockSelection(activeSlide, selectedElementIds),
            };
          }),
        selectAllElements: () =>
          set((state) => {
            const activeSlide = state.presentation.slides.find(
              (slide) => slide.id === state.activeSlideId,
            );

            if (!activeSlide) {
              return state;
            }

            return {
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: activeSlide.elements
                .filter(
                  (element) =>
                    !element.locked &&
                    element.visible !== false &&
                    element.role !== "background",
                )
                .map((element) => element.id),
            };
          }),
        setSlideTheme: (slideId, themeId) =>
          set((state) => {
            let didUpdate = false;
            const slides = state.presentation.slides.map((slide) => {
              if (slide.id !== slideId) {
                return slide;
              }

              didUpdate = true;
              return applyThemeToSlide(slide, themeId);
            });

            return didUpdate
              ? withDocumentHistory(state, {
                  presentation: { ...state.presentation, slides },
                })
              : state;
          }),
        applyThemeToAllSlides: (themeId) =>
          set((state) =>
            withDocumentHistory(state, {
              presentation: {
                ...state.presentation,
                slides: state.presentation.slides.map((slide) =>
                  applyThemeToSlide(slide, themeId),
                ),
              },
            }),
          ),
        undo: () =>
          set((state) => {
            const previous = state.undoStack.at(-1);

            if (!previous) {
              return state;
            }

            const redoStack = [
              ...state.redoStack,
              {
                activeSlideId: state.activeSlideId,
                presentation: state.presentation,
              },
            ].slice(-HISTORY_LIMIT);

            return {
              presentation: reflowTextBlockPresentation(normalizeTablePresentation(normalizeTimelinePresentation(normalizeTeamPresentation(normalizeAgendaPresentation(previous.presentation))))),
              activeSlideId: previous.activeSlideId,
              undoStack: state.undoStack.slice(0, -1),
              redoStack,
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: [],
            };
          }),
        redo: () =>
          set((state) => {
            const next = state.redoStack.at(-1);

            if (!next) {
              return state;
            }

            const undoStack = [
              ...state.undoStack,
              {
                activeSlideId: state.activeSlideId,
                presentation: state.presentation,
              },
            ].slice(-HISTORY_LIMIT);

            return {
              presentation: reflowTextBlockPresentation(normalizeTablePresentation(normalizeTimelinePresentation(normalizeTeamPresentation(normalizeAgendaPresentation(next.presentation))))),
              activeSlideId: next.activeSlideId,
              undoStack,
              redoStack: state.redoStack.slice(0, -1),
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: [],
            };
          }),
        deleteElement: (slideId, elementId) => set((state) => deleteSlideElements(state, slideId, [elementId])),
        deleteElements: (slideId, elementIds) => set((state) => deleteSlideElements(state, slideId, elementIds)),
        duplicateElement: (slideId, elementId) =>
          set((state) => {
            const slideIndex = state.presentation.slides.findIndex(
              (slide) => slide.id === slideId,
            );
            const slide = state.presentation.slides[slideIndex];
            const elementIndex = slide?.elements.findIndex(
              (element) => element.id === elementId,
            );

            const blockId = elementIndex !== undefined && elementIndex >= 0 ? slide?.elements[elementIndex].textBlockId : undefined;
            const block = slide?.textBlocks?.find((block) => block.id === blockId);
            if (slide && block) {
              const duplicated = cloneTextBlock(block, true, 20);
              const updated = upsertTextBlock(slide, duplicated);
              const slides = [...state.presentation.slides];
              slides[slideIndex] = updated;
              return withDocumentHistory(state, {
                presentation: { ...state.presentation, slides },
                editingTextId: null, editingTextSelectAll: false,
                selectedElementIds: updated.elements.filter((element) => element.textBlockId === duplicated.id).map((element) => element.id),
              });
            }

            if (!slide || elementIndex === undefined || elementIndex < 0 || slide.elements[elementIndex].agendaId || slide.elements[elementIndex].teamId || slide.elements[elementIndex].timelineId || slide.elements[elementIndex].tableId) {
              return state;
            }

            // A copied part is a plain element, not a second part of the card.
            const duplicatedElement: SlideElement = {
              ...duplicateElementWithNewId(slide.elements[elementIndex]),
              component: undefined,
            };
            const elements = [...slide.elements];
            elements.splice(elementIndex + 1, 0, duplicatedElement);
            const slides = [...state.presentation.slides];
            slides[slideIndex] = { ...slide, elements };

            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides },
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: [duplicatedElement.id],
            });
          }),
        updateElement: (slideId, elementId, updates) =>
          set((state) => {
            let changed = false;
            const slides = state.presentation.slides.map((slide) => {
              if (slide.id !== slideId) return slide;
              const updated = applySlideElementUpdates(slide, [{ elementId, updates }]);
              changed ||= updated !== slide;
              return updated;
            });
            return changed ? withDocumentHistory(state, { presentation: { ...state.presentation, slides } }) : state;
          }),
        updateElements: (slideId, updates) =>
          set((state) => {
            if (!updates.length) return state;
            let changed = false;
            const slides = state.presentation.slides.map((slide) => {
              if (slide.id !== slideId) return slide;
              const updated = applySlideElementUpdates(slide, updates);
              changed ||= updated !== slide;
              return updated;
            });
            return changed ? withDocumentHistory(state, { presentation: { ...state.presentation, slides } }) : state;
          }),
        deleteSlide: (slideId) =>
          set((state) => {
            const { slides } = state.presentation;
            const deleteIndex = slides.findIndex(
              (slide) => slide.id === slideId,
            );

            if (slides.length <= 1 || deleteIndex < 0) {
              return state;
            }

            const nextSlides = slides.filter((slide) => slide.id !== slideId);
            const activeSlideId =
              state.activeSlideId === slideId
                ? (nextSlides[Math.min(deleteIndex, nextSlides.length - 1)]?.id ??
                  nextSlides[0]?.id ??
                  "")
                : state.activeSlideId;

            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides: nextSlides },
              activeSlideId,
              ...(state.activeSlideId === slideId
                ? {
                    editingTextId: null,
                    editingTextSelectAll: false,
                    selectedElementIds: [],
                  }
                : {}),
            });
          }),
        duplicateSlide: (slideId) =>
          set((state) => {
            const sourceIndex = state.presentation.slides.findIndex(
              (slide) => slide.id === slideId,
            );

            if (sourceIndex < 0) {
              return state;
            }

            const duplicatedSlide = duplicateSlideWithNewIds(
              state.presentation.slides[sourceIndex],
            );
            const slides = [...state.presentation.slides];
            slides.splice(sourceIndex + 1, 0, duplicatedSlide);

            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides },
              activeSlideId: duplicatedSlide.id,
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: [],
            });
          }),
        reorderSlides: (oldIndex, newIndex) =>
          set((state) => {
            const slides = moveSlide(
              state.presentation.slides,
              oldIndex,
              newIndex,
            );

            return slides === state.presentation.slides
              ? state
              : withDocumentHistory(state, {
                  presentation: { ...state.presentation, slides },
                });
          }),
        updateSlide: (slideId, updates) =>
          set((state) => {
            let didUpdate = false;
            const slides = state.presentation.slides.map((slide) => {
              if (slide.id !== slideId) {
                return slide;
              }

              didUpdate = true;
              return { ...slide, ...updates };
            });

            return didUpdate
              ? withDocumentHistory(state, {
                  presentation: { ...state.presentation, slides },
                })
              : state;
          }),
        updateSlideBackground: (slideId, color) => {
          if (!isSolidHexColor(color)) {
            return;
          }

          set((state) =>
            withDocumentHistory(state, {
              presentation: {
                ...state.presentation,
                slides: state.presentation.slides.map((slide) =>
                  slide.id === slideId
                    ? { ...slide, background: color.toUpperCase(), themeId: undefined }
                    : slide,
                ),
              },
            }),
          );
        },
        updatePresentationTitle: (title) =>
          set((state) =>
            withDocumentHistory(state, {
              presentation: { ...state.presentation, title },
            }),
          ),
        toggleLayoutGrid: () =>
          set((state) => ({ showLayoutGrid: !state.showLayoutGrid })),
        setZoom: (scale) =>
          set({ zoom: roundZoom(clampZoom(scale)), zoomMode: "custom" }),
        zoomIn: () =>
          set((state) => ({
            zoom: roundZoom(Math.min(MAX_ZOOM, state.zoom + ZOOM_STEP)),
            zoomMode: "custom",
          })),
        zoomOut: () =>
          set((state) => ({
            zoom: roundZoom(Math.max(MIN_ZOOM, state.zoom - ZOOM_STEP)),
            zoomMode: "custom",
          })),
        fitToWorkspace: (scale) =>
          set({ zoom: roundZoom(clampZoom(scale)), zoomMode: "fit" }),
        startTextEditing: (elementId) =>
          set((state) => {
            const activeSlide = state.presentation.slides.find(
              (slide) => slide.id === state.activeSlideId,
            );
            const element = activeSlide?.elements.find(
              (item) => item.id === elementId,
            );

            return element?.type === "text" && element.visible !== false && !element.agendaId && !element.teamId && !element.timelineId && (!element.tableId || element.tableCell)
              ? {
                  editingTextId: elementId,
                  editingTextSelectAll: Boolean(element.tableCell || element.textBlockId),
                  selectedElementIds: element.textBlockId && activeSlide ? [elementId, ...activeSlide.elements.filter((item) => item.textBlockId === element.textBlockId && item.id !== elementId).map((item) => item.id)] : [elementId],
                }
              : state;
          }),
        stopTextEditing: () =>
          set({ editingTextId: null, editingTextSelectAll: false }),
      }),
      {
        name: EDITOR_STORAGE_KEY,
        version: EDITOR_STORAGE_VERSION,
        skipHydration: true,
        storage: createJSONStorage<PersistedEditorState>(
          createDebouncedLocalStorage,
        ),
        partialize: (state) => ({
          presentation: state.presentation,
          activeSlideId: state.activeSlideId,
        }),
        migrate: (persistedState) =>
          normalizePersistedEditorState(persistedState, initialPresentation),
        merge: (persistedState, currentState) => ({
          ...currentState,
          ...normalizePersistedEditorState(
            persistedState,
            currentState.presentation,
          ),
        }),
        onRehydrateStorage: () => (_state, error) => {
          if (error && typeof window !== "undefined") {
            try {
              window.localStorage.removeItem(EDITOR_STORAGE_KEY);
            } catch {
              // The in-memory editor remains usable when storage is blocked.
            }
          }
        },
      },
    ),
  );
}

export type EditorStoreApi = ReturnType<typeof createEditorStore>;

const EditorStoreContext = createContext<EditorStoreApi | null>(null);

export function EditorStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createEditorStore);

  useEffect(() => {
    void store.persist?.rehydrate();
  }, [store]);

  return (
    <EditorStoreContext.Provider value={store}>
      {children}
    </EditorStoreContext.Provider>
  );
}

export function useEditorStore<T>(selector: (store: EditorStore) => T): T {
  const store = useContext(EditorStoreContext);

  if (!store) {
    throw new Error("useEditorStore must be used within EditorStoreProvider");
  }

  return useStore(store, selector);
}
