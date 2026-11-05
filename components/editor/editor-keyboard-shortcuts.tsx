"use client";

import { useEffect, useRef } from "react";

import {
  cloneElementsForPaste,
  collectElementsToCopy,
  getClipboardText,
  PASTE_OFFSET,
} from "@/lib/editor/element-clipboard";
import { createTextElement } from "@/lib/elements/create-element";
import { applyDarkModeToElement } from "@/lib/slides/dark-mode";
import { useEditorStore } from "@/store/editor-store";
import type { SlideElement } from "@/types/presentation";

// Written to the system clipboard when the copy holds no text, so a paste can
// tell our copy apart from something copied elsewhere since.
const NON_TEXT_CLIPBOARD_MARKER = "[deck elements]";

interface ElementClipboard {
  elements: SlideElement[];
  pasteCounts: Map<string, number>;
  sourceDarkMode: boolean;
  // Null after a cut: the originals are gone, so pasting back stays in place.
  sourceSlideId: string | null;
  text: string;
}

// Copying page text (e.g. in the side panels) keeps the browser's behaviour.
function hasTextSelection() {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed);
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.matches("input, textarea, select") ||
    Boolean(target.closest("[contenteditable='true']"))
  );
}

export function EditorKeyboardShortcuts() {
  const slides = useEditorStore((state) => state.presentation.slides);
  const activeSlideId = useEditorStore((state) => state.activeSlideId);
  const selectSlide = useEditorStore((state) => state.selectSlide);
  const duplicateSlide = useEditorStore((state) => state.duplicateSlide);
  const selectedElementIds = useEditorStore(
    (state) => state.selectedElementIds,
  );
  const duplicateElement = useEditorStore(
    (state) => state.duplicateElement,
  );
  const deleteElements = useEditorStore((state) => state.deleteElements);
  const updateElement = useEditorStore((state) => state.updateElement);
  const updateElements = useEditorStore((state) => state.updateElements);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const selectAllElements = useEditorStore(
    (state) => state.selectAllElements,
  );
  const addElement = useEditorStore((state) => state.addElement);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const addElements = useEditorStore((state) => state.addElements);
  const clipboardRef = useRef<ElementClipboard | null>(null);

  // Copy, cut and paste of elements, across slides. The copy lives in memory;
  // the system clipboard only carries its text so other apps can use it.
  useEffect(() => {
    const copySelection = (event: ClipboardEvent, isCut = false) => {
      const slide = slides.find((item) => item.id === activeSlideId);
      const elements = slide
        ? collectElementsToCopy(slide.elements, selectedElementIds)
        : [];

      if (!slide || elements.length === 0) {
        return false;
      }

      const text = getClipboardText(elements) || NON_TEXT_CLIPBOARD_MARKER;
      clipboardRef.current = {
        elements,
        pasteCounts: new Map(),
        sourceDarkMode: slide.darkMode === true,
        sourceSlideId: isCut ? null : slide.id,
        text,
      };
      event.clipboardData?.setData("text/plain", text);
      event.preventDefault();
      return true;
    };

    const shouldIgnore = (event: ClipboardEvent) =>
      event.defaultPrevented ||
      isTypingTarget(event.target) ||
      hasTextSelection();

    const handleCopy = (event: ClipboardEvent) => {
      if (!shouldIgnore(event)) {
        copySelection(event);
      }
    };

    const handleCut = (event: ClipboardEvent) => {
      if (!shouldIgnore(event) && copySelection(event, true)) {
        deleteElements(activeSlideId, selectedElementIds);
      }
    };

    const handlePaste = (event: ClipboardEvent) => {
      const clipboard = clipboardRef.current;

      if (
        !clipboard ||
        !activeSlideId ||
        event.defaultPrevented ||
        isTypingTarget(event.target) ||
        // Something else was copied since; leave that paste alone.
        event.clipboardData?.getData("text/plain") !== clipboard.text
      ) {
        return;
      }

      event.preventDefault();

      // Pasting onto another slide keeps the position; repeats shift.
      const count = clipboard.pasteCounts.get(activeSlideId) ?? 0;
      const steps =
        activeSlideId === clipboard.sourceSlideId ? count + 1 : count;
      clipboard.pasteCounts.set(activeSlideId, count + 1);

      const elements = cloneElementsForPaste(
        clipboard.elements,
        steps * PASTE_OFFSET,
      );
      // addElements already lightens text for dark slides; undo that when
      // the copy came from one.
      addElements(
        activeSlideId,
        clipboard.sourceDarkMode
          ? elements.map((element) => applyDarkModeToElement(element, false))
          : elements,
      );
    };

    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("paste", handlePaste);
    };
  }, [activeSlideId, addElements, deleteElements, selectedElementIds, slides]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) {
        return;
      }

      if (
        !event.repeat &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (
        !event.repeat &&
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "a"
      ) {
        event.preventDefault();
        selectAllElements();
        return;
      }

      if (
        !event.repeat &&
        event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "y"
      ) {
        event.preventDefault();
        redo();
        return;
      }

      const activeIndex = slides.findIndex(
        (slide) => slide.id === activeSlideId,
      );
      const selectedElementId = selectedElementIds[0];
      const selectedElements = slides[activeIndex]?.elements.filter(
        (element) => selectedElementIds.includes(element.id),
      ) ?? [];
      const selectedElement = selectedElements[0];

      if (event.key === "Escape" && selectedElementId) {
        event.preventDefault();
        clearSelection();
        return;
      }

      if (
        !event.repeat &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        event.key.toLowerCase() === "t" &&
        activeSlideId
      ) {
        event.preventDefault();
        addElement(activeSlideId, createTextElement());
        return;
      }

      if (
        !event.repeat &&
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        selectedElement?.type === "text" &&
        event.key.toLowerCase() === "b"
      ) {
        event.preventDefault();
        updateElement(activeSlideId, selectedElement.id, {
          fontWeight: selectedElement.fontWeight === 700 ? 400 : 700,
        });
        return;
      }

      if (
        !event.repeat &&
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        selectedElement?.type === "text" &&
        event.key.toLowerCase() === "i"
      ) {
        event.preventDefault();
        updateElement(activeSlideId, selectedElement.id, {
          italic: !selectedElement.italic,
        });
        return;
      }

      if (
        selectedElements.length > 0 &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
          event.key,
        )
      ) {
        event.preventDefault();

        const distance = event.shiftKey ? 10 : 1;
        const horizontalDelta =
          event.key === "ArrowLeft"
            ? -distance
            : event.key === "ArrowRight"
              ? distance
              : 0;
        const verticalDelta =
          event.key === "ArrowUp"
            ? -distance
            : event.key === "ArrowDown"
              ? distance
              : 0;

        updateElements(
          activeSlideId,
          selectedElements
            .filter(
              (element) =>
                !element.locked && element.visible !== false,
            )
            .map((element) => ({
              elementId: element.id,
              updates: {
                x: element.x + horizontalDelta,
                y: element.y + verticalDelta,
              },
            })),
        );
        return;
      }

      if (
        !selectedElement &&
        (event.key === "ArrowUp" || event.key === "PageUp")
      ) {
        if (activeIndex > 0) {
          event.preventDefault();
          selectSlide(slides[activeIndex - 1].id);
        }
        return;
      }

      if (
        !selectedElement &&
        (event.key === "ArrowDown" || event.key === "PageDown")
      ) {
        if (activeIndex >= 0 && activeIndex < slides.length - 1) {
          event.preventDefault();
          selectSlide(slides[activeIndex + 1].id);
        }
        return;
      }

      if (
        !event.repeat &&
        event.shiftKey &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "d" &&
        activeIndex >= 0
      ) {
        event.preventDefault();
        duplicateSlide(activeSlideId);
        return;
      }

      if (
        !event.repeat &&
        !event.shiftKey &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "d" &&
        selectedElementId
      ) {
        event.preventDefault();
        duplicateElement(activeSlideId, selectedElementId);
        return;
      }

      if (
        !event.repeat &&
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedElementId
      ) {
        event.preventDefault();
        deleteElements(activeSlideId, selectedElementIds);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeSlideId,
    addElement,
    clearSelection,
    deleteElements,
    duplicateElement,
    duplicateSlide,
    redo,
    selectAllElements,
    selectSlide,
    selectedElementIds,
    slides,
    undo,
    updateElement,
    updateElements,
  ]);

  return null;
}
