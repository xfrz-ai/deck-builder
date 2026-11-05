"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import {
  GENERATOR_PREVIEW_BACKGROUND,
  GeneratorDialog,
  generatorInputClassName,
} from "@/components/editor/generator-dialog";
import { Button } from "@/components/ui/button";
import { createUniqueId } from "@/lib/id";
import {
  createScopeOfWorkElements,
  estimateScopeLabelWidth,
  getScopeSectionError,
  MAX_SCOPE_SECTIONS,
  type MeasureScopeLabel,
} from "@/lib/scope-of-work/scope-of-work-elements";
import { getCanvasFont, measureTextWidth } from "@/lib/text/measure-text";
import { cn } from "@/lib/utils";
import { selectActiveSlide, useEditorStore } from "@/store/editor-store";
import type { Slide } from "@/types/presentation";

const FONT_FAMILY = "Plus Jakarta Sans";
const LIGHT_LINE_COLOR = "#111111";
const DARK_LINE_COLOR = "#FFFFFF";

interface ScopeItemInput {
  id: string;
  text: string;
}

interface ScopeSectionInput {
  id: string;
  title: string;
  items: ScopeItemInput[];
}

function createItem(text = ""): ScopeItemInput {
  return { id: createUniqueId("element"), text };
}

function createSection(
  title: string,
  items: readonly string[],
): ScopeSectionInput {
  return {
    id: createUniqueId("element"),
    title,
    items: items.map((item) => createItem(item)),
  };
}

function createDefaultSections() {
  return [
    createSection("Web Ecommerce", [
      "Homepage",
      "Product Detail",
      "Shopping Cart",
    ]),
  ];
}

function toScopeSections(sections: readonly ScopeSectionInput[]) {
  return sections.map((section) => ({
    title: section.title,
    items: section.items.map((item) => item.text),
  }));
}

interface ScopeOfWorkGeneratorDialogProps {
  onClose: () => void;
}

export function ScopeOfWorkGeneratorDialog({
  onClose,
}: ScopeOfWorkGeneratorDialogProps) {
  const fieldIdPrefix = useId();
  const [sections, setSections] = useState(createDefaultSections);
  const [isFontReady, setIsFontReady] = useState(false);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const activeSlide = useEditorStore(selectActiveSlide);
  const addElements = useEditorStore((state) => state.addElements);

  // Pill widths come from the real font, so wait for it before measuring.
  useEffect(() => {
    let isMounted = true;

    document.fonts
      .load(getCanvasFont(FONT_FAMILY, 20))
      .catch(() => undefined)
      .then(() => {
        if (isMounted) {
          setIsFontReady(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (focusItemId) {
      document.getElementById(`${fieldIdPrefix}-${focusItemId}`)?.focus();
    }
  }, [fieldIdPrefix, focusItemId]);

  const measureLabel = useMemo<MeasureScopeLabel>(
    () => (label, fontSize) =>
      (isFontReady && measureTextWidth(label, FONT_FAMILY, fontSize)) ||
      estimateScopeLabelWidth(label, fontSize),
    [isFontReady],
  );
  const scopeSections = useMemo(() => toScopeSections(sections), [sections]);
  const errors = scopeSections.map((section) =>
    getScopeSectionError(section, measureLabel),
  );
  const hasErrors = errors.some(Boolean);
  const previewSlide = useMemo<Slide>(
    () => ({
      id: "scope-of-work-preview",
      background: GENERATOR_PREVIEW_BACKGROUND,
      elements: createScopeOfWorkElements(
        scopeSections,
        "scope-of-work-preview",
        { measureLabel },
      ),
    }),
    [measureLabel, scopeSections],
  );

  const updateSection = (
    sectionId: string,
    update: (section: ScopeSectionInput) => ScopeSectionInput,
  ) =>
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId ? update(section) : section,
      ),
    );

  const addSection = () =>
    setSections((current) =>
      current.length >= MAX_SCOPE_SECTIONS
        ? current
        : [...current, createSection("", [""])],
    );

  const removeSection = (sectionId: string) =>
    setSections((current) =>
      current.filter((section) => section.id !== sectionId),
    );

  const addItem = (sectionId: string, afterItemId?: string) => {
    const item = createItem();

    updateSection(sectionId, (section) => {
      const index = section.items.findIndex(({ id }) => id === afterItemId);
      const insertIndex = index < 0 ? section.items.length : index + 1;

      return {
        ...section,
        items: [
          ...section.items.slice(0, insertIndex),
          item,
          ...section.items.slice(insertIndex),
        ],
      };
    });
    setFocusItemId(item.id);
  };

  const updateItem = (sectionId: string, itemId: string, text: string) =>
    updateSection(sectionId, (section) => ({
      ...section,
      items: section.items.map((item) =>
        item.id === itemId ? { ...item, text } : item,
      ),
    }));

  const removeItem = (sectionId: string, itemId: string) =>
    updateSection(sectionId, (section) => ({
      ...section,
      items: section.items.filter((item) => item.id !== itemId),
    }));

  const handleInsert = () => {
    if (!activeSlide || hasErrors) {
      return;
    }

    const line = activeSlide.darkMode ? DARK_LINE_COLOR : LIGHT_LINE_COLOR;
    addElements(
      activeSlide.id,
      createScopeOfWorkElements(scopeSections, createUniqueId("element"), {
        // Text stays black; the store turns it white on dark slides.
        colors: { text: LIGHT_LINE_COLOR, line },
        measureLabel,
      }),
    );
    onClose();
  };

  return (
    <GeneratorDialog
      closeLabel="Close scope of work generator"
      description="Add up to three cards with their items. Numbers are added automatically."
      insertDisabled={!activeSlide || hasErrors}
      insertLabel="Insert scope of work"
      onClose={onClose}
      onInsert={handleInsert}
      previewEmptyMessage="Add a card to see the preview."
      previewNote="Inserted on the current slide. Items wrap to fit each card."
      previewSlide={previewSlide}
      title="Insert scope of work"
    >
      {sections.map((section, index) => {
        const error = errors[index];
        const cardNumber = String(index + 1).padStart(2, "0");
        const fieldId = `${fieldIdPrefix}-${section.id}`;

        return (
          <fieldset
            aria-label={`Card ${cardNumber}`}
            className={cn(
              "rounded-2xl border p-3 transition-colors",
              error
                ? "border-destructive/40 bg-[#fff6f4]"
                : "border-stroke-01 bg-surface-01",
            )}
            key={section.id}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">
                Card {cardNumber}
              </span>
              <Button
                aria-label={`Remove card ${cardNumber}`}
                className="text-muted-foreground hover:text-destructive"
                disabled={sections.length === 1}
                onClick={() => removeSection(section.id)}
                size="icon-sm"
                variant="ghost"
              >
                <Trash2 className="size-3.5" strokeWidth={1.8} />
              </Button>
            </div>

            <label
              className="mb-2 block space-y-1.5 text-[11px] font-medium text-muted-foreground"
              htmlFor={`${fieldId}-title`}
            >
              <span>Title</span>
              <input
                className={generatorInputClassName}
                id={`${fieldId}-title`}
                maxLength={32}
                onChange={(event) =>
                  updateSection(section.id, (current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="e.g. Web Ecommerce"
                value={section.title}
              />
            </label>

            <div className="space-y-1.5">
              <span className="block text-[11px] font-medium text-muted-foreground">
                Items
              </span>
              {section.items.map((item, itemIndex) => (
                <div className="flex items-center gap-1" key={item.id}>
                  <input
                    aria-label={`Card ${cardNumber} item ${itemIndex + 1}`}
                    className={generatorInputClassName}
                    id={`${fieldIdPrefix}-${item.id}`}
                    maxLength={60}
                    onChange={(event) =>
                      updateItem(section.id, item.id, event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        addItem(section.id, item.id);
                      }
                    }}
                    placeholder="e.g. Homepage"
                    value={item.text}
                  />
                  <Button
                    aria-label={`Remove card ${cardNumber} item ${itemIndex + 1}`}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(section.id, item.id)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.8} />
                  </Button>
                </div>
              ))}
              <Button
                className="w-full"
                onClick={() => addItem(section.id)}
                size="sm"
                variant="ghost"
              >
                <Plus className="size-3.5" strokeWidth={2} />
                Add item
              </Button>
            </div>

            {error ? (
              <p className="mt-2 text-[11px] font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </fieldset>
        );
      })}

      <Button
        className="w-full"
        disabled={sections.length >= MAX_SCOPE_SECTIONS}
        onClick={addSection}
        variant="outline"
      >
        <Plus className="size-4" strokeWidth={2} />
        {sections.length >= MAX_SCOPE_SECTIONS
          ? `Maximum ${MAX_SCOPE_SECTIONS} cards`
          : "Add card"}
      </Button>
    </GeneratorDialog>
  );
}
