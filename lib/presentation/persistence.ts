import type { StateStorage } from "zustand/middleware";

import { notifyEditor } from "@/lib/editor/notifications";
import { isPresentation } from "@/lib/presentation/validation";
import type { Presentation } from "@/types/presentation";

export const EDITOR_STORAGE_KEY = "presentation-editor-storage";
export const EDITOR_STORAGE_VERSION = 4;
const PERSISTENCE_DEBOUNCE_MS = 400;
const STORAGE_FULL_MESSAGE =
  "Storage is full. Remove some large images or use smaller files.";
const EDITABLE_TEMPLATE_ASSET_SOURCES = new Set(["/assets/logo-brand.png"]);

function isQuotaExceededError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22 ||
      error.code === 1014)
  );
}

export interface PersistedEditorState {
  presentation: Presentation;
  activeSlideId: string;
}

function migrateEditableTemplateAssets(
  presentation: Presentation,
): Presentation {
  let didChange = false;
  const slides = presentation.slides.map((slide) => {
    let didChangeSlide = false;
    const elements = slide.elements.map((element) => {
      if (
        element.type !== "image" ||
        !EDITABLE_TEMPLATE_ASSET_SOURCES.has(element.src) ||
        element.locked === false
      ) {
        return element;
      }

      didChange = true;
      didChangeSlide = true;
      return { ...element, locked: false };
    });

    return didChangeSlide ? { ...slide, elements } : slide;
  });

  return didChange ? { ...presentation, slides } : presentation;
}

export function normalizePersistedEditorState(
  value: unknown,
  fallbackPresentation: Presentation,
): PersistedEditorState {
  if (
    typeof value !== "object" ||
    value === null ||
    !("presentation" in value) ||
    !isPresentation(value.presentation)
  ) {
    return {
      presentation: fallbackPresentation,
      activeSlideId: fallbackPresentation.slides[0]?.id ?? "",
    };
  }

  const presentation = migrateEditableTemplateAssets(value.presentation);
  const activeSlideId =
    "activeSlideId" in value && typeof value.activeSlideId === "string"
      ? value.activeSlideId
      : "";
  const activeSlideExists = presentation.slides.some(
    (slide) => slide.id === activeSlideId,
  );

  return {
    presentation,
    activeSlideId: activeSlideExists
      ? activeSlideId
      : (presentation.slides[0]?.id ?? ""),
  };
}

export function createDebouncedLocalStorage(): StateStorage {
  const pendingValues = new Map<string, string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const flush = (key: string) => {
    const value = pendingValues.get(key);

    if (value === undefined) {
      return;
    }

    let didPersist = false;

    try {
      window.localStorage.setItem(key, value);
      didPersist = true;
    } catch (error) {
      // The editor remains usable if storage is unavailable or full.
      notifyEditor(
        isQuotaExceededError(error)
          ? STORAGE_FULL_MESSAGE
          : "Changes could not be saved to this browser.",
      );
    }

    if (didPersist) {
      pendingValues.delete(key);
    }
    timers.delete(key);
  };

  window.addEventListener("pagehide", () => {
    pendingValues.forEach((_, key) => flush(key));
  });

  return {
    getItem: (key) => {
      try {
        return pendingValues.get(key) ?? window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      pendingValues.set(key, value);

      const activeTimer = timers.get(key);
      if (activeTimer) {
        clearTimeout(activeTimer);
      }

      timers.set(key, setTimeout(() => flush(key), PERSISTENCE_DEBOUNCE_MS));
    },
    removeItem: (key) => {
      const activeTimer = timers.get(key);
      if (activeTimer) {
        clearTimeout(activeTimer);
      }

      pendingValues.delete(key);
      timers.delete(key);
      try {
        window.localStorage.removeItem(key);
      } catch {
        // The in-memory editor remains usable when storage is blocked.
      }
    },
  };
}
