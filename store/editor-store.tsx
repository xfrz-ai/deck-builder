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
  applyBackgroundThemeToSlide,
  type BackgroundThemeId,
} from "@/lib/backgrounds/background-themes";
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
import {
  applyDarkModeToElement,
  applyDarkModeToSlide,
} from "@/lib/slides/dark-mode";
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
  addElement: (slideId: string, element: SlideElement) => void;
  addElements: (slideId: string, elements: readonly SlideElement[]) => void;
  addLayoutSlide: (layoutId: SlideLayoutId) => void;
  addSlide: () => void;
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
  setSlideBackgroundTheme: (
    slideId: string,
    themeId: BackgroundThemeId,
  ) => void;
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
  toggleSlideDarkMode: (slideId: string) => void;
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

export const selectActiveSlide = (state: EditorStore) =>
  state.presentation.slides.find(
    (slide) => slide.id === state.activeSlideId,
  ) ?? state.presentation.slides[0];

export function createEditorStore(
  initialPresentation = createDefaultPresentation(),
) {
  return createStore<EditorStore>()(
    persist(
      (set) => ({
        presentation: initialPresentation,
        activeSlideId: initialPresentation.slides[0]?.id ?? "",
        editingTextId: null,
        editingTextSelectAll: false,
        selectedElementIds: [],
        zoom: 1,
        zoomMode: "fit",
        showLayoutGrid: false,
        undoStack: [],
        redoStack: [],
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
            slides[slideIndex] = {
              ...slide,
              elements: [...slide.elements, ...addedElements],
            };

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

            if (additive) {
              const selectedElementIds = state.selectedElementIds.includes(
                elementId,
              )
                ? state.selectedElementIds.filter((id) => id !== elementId)
                : [...state.selectedElementIds, elementId];

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
              selectedElementIds,
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
        setSlideBackgroundTheme: (slideId, themeId) =>
          set((state) => {
            let didUpdate = false;
            const slides = state.presentation.slides.map((slide) => {
              if (slide.id !== slideId) {
                return slide;
              }

              didUpdate = true;
              const themedSlide = applyBackgroundThemeToSlide(slide, themeId);
              return slide.darkMode
                ? applyDarkModeToSlide(themedSlide, true)
                : themedSlide;
            });

            return didUpdate
              ? withDocumentHistory(state, {
                  presentation: { ...state.presentation, slides },
                })
              : state;
          }),
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
              presentation: previous.presentation,
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
              presentation: next.presentation,
              activeSlideId: next.activeSlideId,
              undoStack,
              redoStack: state.redoStack.slice(0, -1),
              editingTextId: null,
              editingTextSelectAll: false,
              selectedElementIds: [],
            };
          }),
        deleteElement: (slideId, elementId) =>
          set((state) => {
            let didDelete = false;
            const slides = state.presentation.slides.map((slide) => {
              if (slide.id !== slideId) {
                return slide;
              }

              const elements = slide.elements.filter((element) => {
                const shouldDelete = element.id === elementId;
                didDelete ||= shouldDelete;
                return !shouldDelete;
              });

              return didDelete
                ? { ...slide, elements: removeOrphanedCardParts(elements) }
                : slide;
            });

            if (!didDelete) {
              return state;
            }

            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides },
              editingTextId:
                state.editingTextId === elementId
                  ? null
                  : state.editingTextId,
              editingTextSelectAll:
                state.editingTextId === elementId
                  ? false
                  : state.editingTextSelectAll,
              selectedElementIds: state.selectedElementIds.includes(elementId)
                ? []
                : state.selectedElementIds,
            });
          }),
        deleteElements: (slideId, elementIds) =>
          set((state) => {
            const idsToDelete = new Set(elementIds);
            let didDelete = false;
            const slides = state.presentation.slides.map((slide) => {
              if (slide.id !== slideId) {
                return slide;
              }

              const elements = slide.elements.filter(
                (element) => !idsToDelete.has(element.id),
              );

              if (elements.length === slide.elements.length) {
                return slide;
              }

              didDelete = true;
              return { ...slide, elements: removeOrphanedCardParts(elements) };
            });

            if (!didDelete) {
              return state;
            }

            const isEditingDeleted =
              state.editingTextId !== null &&
              idsToDelete.has(state.editingTextId);

            return withDocumentHistory(state, {
              presentation: { ...state.presentation, slides },
              editingTextId: isEditingDeleted ? null : state.editingTextId,
              editingTextSelectAll: isEditingDeleted
                ? false
                : state.editingTextSelectAll,
              selectedElementIds: state.selectedElementIds.filter(
                (id) => !idsToDelete.has(id),
              ),
            });
          }),
        duplicateElement: (slideId, elementId) =>
          set((state) => {
            const slideIndex = state.presentation.slides.findIndex(
              (slide) => slide.id === slideId,
            );
            const slide = state.presentation.slides[slideIndex];
            const elementIndex = slide?.elements.findIndex(
              (element) => element.id === elementId,
            );

            if (!slide || elementIndex === undefined || elementIndex < 0) {
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
            let didUpdate = false;
            const slides = state.presentation.slides.map((slide) => {
              if (slide.id !== slideId) {
                return slide;
              }

              const elements = slide.elements.map((element) => {
                if (element.id !== elementId) {
                  return element;
                }

                didUpdate = true;
                return { ...element, ...updates };
              });

              return didUpdate ? { ...slide, elements } : slide;
            });

            return didUpdate
              ? withDocumentHistory(state, {
                  presentation: { ...state.presentation, slides },
                })
              : state;
          }),
        updateElements: (slideId, updates) =>
          set((state) => {
            if (updates.length === 0) {
              return state;
            }

            const updateMap = new Map(
              updates.map((update) => [update.elementId, update.updates]),
            );
            let didUpdate = false;
            const slides = state.presentation.slides.map((slide) => {
              if (slide.id !== slideId) {
                return slide;
              }

              let didUpdateSlide = false;
              const elements = slide.elements.map((element) => {
                const elementUpdates = updateMap.get(element.id);

                if (!elementUpdates) {
                  return element;
                }

                didUpdate = true;
                didUpdateSlide = true;
                return { ...element, ...elementUpdates } as SlideElement;
              });

              return didUpdateSlide ? { ...slide, elements } : slide;
            });

            return didUpdate
              ? withDocumentHistory(state, {
                  presentation: { ...state.presentation, slides },
                })
              : state;
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
        toggleSlideDarkMode: (slideId) =>
          set((state) => {
            let didUpdate = false;
            const slides = state.presentation.slides.map((slide) => {
              if (slide.id !== slideId) {
                return slide;
              }

              didUpdate = true;
              return applyDarkModeToSlide(slide, !slide.darkMode);
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
                    ? { ...slide, background: color.toUpperCase() }
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

            return element?.type === "text" && element.visible !== false
              ? {
                  editingTextId: elementId,
                  editingTextSelectAll: false,
                  selectedElementIds: [elementId],
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
