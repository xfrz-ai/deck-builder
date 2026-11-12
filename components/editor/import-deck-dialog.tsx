"use client";

import { ChevronLeft, ChevronRight, FileText, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import { GeneratorDialog } from "@/components/editor/generator-dialog";
import { Button } from "@/components/ui/button";
import { AI_BRIDGE_ENABLED } from "@/lib/ai/bridge-client";
import { generateDeckSpec, type DeckGenerationMode, type DeckGenerationStage } from "@/lib/ai/deck-generation";
import { buildDeckFromSpec } from "@/lib/deck-spec/build-deck";
import type { DeckBuildResult, DeckTextMeasure } from "@/lib/deck-spec/deck-spec";
import { readSourceDocument, type SourceDocument } from "@/lib/deck-spec/source-document";
import { notifyEditor } from "@/lib/editor/notifications";
import { estimateComponentText } from "@/lib/text/component-text";
import { getCanvasFont, measureTextWidth } from "@/lib/text/measure-text";
import { cn } from "@/lib/utils";
import type { Presentation } from "@/types/presentation";

const CATALOG_URL = "/deck-spec/catalog.json";
const MAX_SPEC_BYTES = 5_000_000;

// Canvas measurement once the brand font is loaded, so "fits" means the same
// as in the component forms.
function useDeckTextMeasure(): DeckTextMeasure {
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      document.fonts.load(getCanvasFont("Plus Jakarta Sans", 24, 400)),
      document.fonts.load(getCanvasFont("Plus Jakarta Sans", 40, 700)),
    ]).then(() => {
      if (mounted) setFontReady(true);
    });
    return () => { mounted = false; };
  }, []);
  return useMemo<DeckTextMeasure>(() => (text, size, weight = 400, spacing = 0) => {
    const width = fontReady ? measureTextWidth(text, "Plus Jakarta Sans", size, weight >= 600 ? 700 : 400) : null;
    return width === null
      ? estimateComponentText(text, size, weight, spacing)
      : width + Math.max(0, Array.from(text).length - 1) * spacing;
  }, [fontReady]);
}

type ParseResult =
  | { kind: "empty" }
  | { kind: "invalid"; message: string }
  | { kind: "built"; result: DeckBuildResult };

type Tab = "document" | "json";

function Segmented<T extends string>({ label, onChange, options, value }: {
  label: string;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  value: T;
}) {
  return (
    <div aria-label={label} className="flex shrink-0 gap-1 rounded-[10px] bg-surface-03 p-1" role="radiogroup">
      {options.map((option) => (
        <button
          aria-checked={value === option.value}
          className={cn(
            "h-7 flex-1 rounded-lg text-xs font-medium transition-colors",
            value === option.value ? "bg-surface-01 text-primary shadow-sm" : "text-muted-foreground hover:text-primary",
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
          role="radio"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FileButton({ accept, children, onFile }: { accept: string; children: ReactNode; onFile: (file: File) => void }) {
  return (
    <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] border border-stroke-01 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-surface-03">
      {children}
      <input
        accept={accept}
        className="sr-only"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
        type="file"
      />
    </label>
  );
}

function stageLabel(stage: DeckGenerationStage) {
  return stage.kind === "drafting"
    ? "Claude is drafting the deck…"
    : `Fixing ${stage.problems} problem${stage.problems === 1 ? "" : "s"} (round ${stage.attempt})…`;
}

export type ImportDeckMode = "replace" | "append" | "new";

// In the editor ("replace"/"append") the slides go into the open deck. On the
// home page ("new") they become a new presentation.
export function ImportDeckDialog({ onClose, onImport, target = "current" }: {
  onClose: () => void;
  onImport: (presentation: Presentation, mode: ImportDeckMode) => void | Promise<void>;
  target?: "current" | "new";
}) {
  const measure = useDeckTextMeasure();
  const [tab, setTab] = useState<Tab>(AI_BRIDGE_ENABLED ? "document" : "json");
  const [source, setSource] = useState("");
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [previewIndex, setPreviewIndex] = useState(0);

  const [sourceDocument, setSourceDocument] = useState<SourceDocument | null>(null);
  const [documentError, setDocumentError] = useState("");
  const [generationMode, setGenerationMode] = useState<DeckGenerationMode>("restyle");
  const [stage, setStage] = useState<DeckGenerationStage | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!stage) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [stage?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsed = useMemo<ParseResult>(() => {
    if (!source.trim()) return { kind: "empty" };
    let spec: unknown;
    try {
      spec = JSON.parse(source);
    } catch (error) {
      return { kind: "invalid", message: error instanceof Error ? error.message : "The JSON is invalid." };
    }
    return { kind: "built", result: buildDeckFromSpec(spec, measure) };
  }, [measure, source]);

  const result = parsed.kind === "built" ? parsed.result : null;
  const slides = result?.presentation.slides ?? [];
  const index = Math.min(previewIndex, Math.max(0, slides.length - 1));
  const errorCount = result?.errors.length ?? 0;
  const generating = stage !== null;

  const handleDocument = async (file: File) => {
    setDocumentError("");
    setSourceDocument(null);
    try {
      setSourceDocument(await readSourceDocument(file));
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : "The file could not be read.");
    }
  };

  const handleGenerate = async () => {
    if (!sourceDocument || generating) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setDocumentError("");
    setNotes([]);
    setElapsed(0);
    try {
      const generated = await generateDeckSpec({ document: sourceDocument, measure, mode: generationMode, onStage: setStage, signal: controller.signal });
      setSource(JSON.stringify(generated.spec, null, 2));
      setNotes(generated.notes);
      setPreviewIndex(0);
    } catch (error) {
      if (!controller.signal.aborted) setDocumentError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStage(null);
    }
  };

  const handleSpecFile = async (file: File) => {
    if (file.size > MAX_SPEC_BYTES) {
      notifyEditor("That file is too large for a deck spec.");
      return;
    }
    setSource(await file.text());
    setNotes([]);
    setPreviewIndex(0);
  };

  const handleImport = async () => {
    if (!result || slides.length === 0) return;
    try {
      await onImport(result.presentation, target === "new" ? "new" : mode);
      onClose();
    } catch (error) {
      notifyEditor(error instanceof Error ? error.message : "The deck could not be imported.");
    }
  };

  const slideLabel = `${slides.length} slide${slides.length === 1 ? "" : "s"}`;
  const insertLabel = slides.length === 0
    ? "Import"
    : errorCount > 0
      ? "Import anyway"
    : target === "new" ? `Create presentation (${slideLabel})`
    : mode === "replace" ? `Replace deck (${slideLabel})` : `Add ${slideLabel}`;

  return (
    <GeneratorDialog
      closeLabel="Close import"
      description={tab === "document" ? "Turn a Markdown or PowerPoint file into WKND slides with Claude." : "Build WKND slides from a deck spec (JSON)."}
      insertDisabled={slides.length === 0 || generating}
      insertLabel={insertLabel}
      onClose={onClose}
      onInsert={handleImport}
      previewEmptyMessage={generating ? "The preview appears when Claude is done." : parsed.kind === "invalid" ? "Fix the JSON to see a preview." : tab === "document" ? "Upload a document and generate the deck." : "Paste a deck spec to see its slides."}
      previewNote={slides.length ? `Slide ${index + 1} of ${slides.length}. Slides with errors are shown as built; you can still edit them after importing.` : "The layouts set every position, color and font."}
      previewSlide={slides[index] ?? null}
      title="Import deck"
    >
      <Segmented
        label="Import source"
        onChange={setTab}
        options={[{ value: "document", label: "Document (MD, PPTX)" }, { value: "json", label: "Deck spec (JSON)" }]}
        value={tab}
      />

      {tab === "document" ? (
        AI_BRIDGE_ENABLED ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FileButton accept=".md,.markdown,.txt,.pptx" onFile={handleDocument}>
                <FileText aria-hidden="true" className="size-3.5" />
                {sourceDocument ? "Change file" : "Upload .md or .pptx"}
              </FileButton>
              {sourceDocument ? (
                <div className="min-w-0 text-[11px] leading-snug">
                  <p className="truncate font-medium text-primary">{sourceDocument.name}</p>
                  <p className="truncate text-muted-foreground">{sourceDocument.summary}</p>
                </div>
              ) : null}
            </div>

            <Segmented
              label="How to use the content"
              onChange={setGenerationMode}
              options={[{ value: "restyle", label: "Keep content" }, { value: "rewrite", label: "Rewrite & condense" }]}
              value={generationMode}
            />
            <p className="text-[11px] leading-snug text-muted-foreground">
              {generationMode === "restyle"
                ? "Keeps the slides, order and wording. Only text that doesn't fit is shortened."
                : "Lets Claude restructure the story into about 12–20 slides, keeping the facts and placeholders."}
            </p>

            {generating ? (
              <div className="flex items-center gap-2 rounded-[10px] bg-surface-03 p-2.5 text-xs text-primary">
                <LoaderCircle aria-hidden="true" className="size-3.5 shrink-0 animate-spin" />
                <span className="flex-1">{stageLabel(stage)} {elapsed}s</span>
                <button className="cursor-pointer text-muted-foreground underline underline-offset-2 hover:text-primary" onClick={() => abortRef.current?.abort()} type="button">
                  Cancel
                </button>
              </div>
            ) : (
              <Button disabled={!sourceDocument} onClick={handleGenerate}>
                {slides.length ? "Generate again" : "Generate deck"}
              </Button>
            )}
            {generating ? <p className="text-[11px] text-muted-foreground">A long document can take a few minutes.</p> : null}
            {documentError ? <p className="rounded-[10px] bg-[#E04E2B]/10 p-2.5 text-xs text-[#B3361A]">{documentError}</p> : null}

            {notes.length ? (
              <div className="flex flex-col gap-1 rounded-[10px] border border-stroke-01 p-2.5">
                <p className="text-xs font-semibold text-primary">Claude&apos;s notes</p>
                <ul className="flex list-disc flex-col gap-1 pl-4 text-[11px] leading-snug text-muted-foreground">
                  {notes.map((note, noteIndex) => <li key={noteIndex}>{note}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="rounded-[10px] bg-surface-03 p-2.5 text-xs leading-relaxed text-muted-foreground">
            Importing documents uses Claude Code on your machine. Run the editor with <code>npm run dev</code> and start <code>npm run ai-bridge</code>, or paste a deck spec instead.
          </p>
        )
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <FileButton accept="application/json,.json" onFile={handleSpecFile}>Upload .json</FileButton>
            <a className="text-xs text-muted-foreground underline underline-offset-2 hover:text-primary" href={CATALOG_URL} rel="noreferrer" target="_blank">
              Layout catalog
            </a>
          </div>
          <textarea
            aria-label="Deck spec JSON"
            className="editor-scrollbar h-56 w-full shrink-0 resize-none rounded-[10px] border border-surface-03 bg-surface-03 p-2.5 font-mono text-[11px] leading-relaxed text-primary outline-none transition-colors focus:border-stroke-02 focus:bg-surface-02"
            onChange={(event) => {
              setSource(event.target.value);
              setPreviewIndex(0);
            }}
            placeholder='{ "version": 1, "title": "…", "slides": [{ "layout": "wknd-cover-brand", "content": { "title": "…" } }] }'
            spellCheck={false}
            value={source}
          />
        </>
      )}

      {slides.length ? (
        <>
          {target === "current" ? (
            <Segmented
              label="Import mode"
              onChange={setMode}
              options={[{ value: "replace", label: "Replace deck" }, { value: "append", label: "Add to deck" }]}
              value={mode}
            />
          ) : null}
          {slides.length > 1 ? (
            <div className="flex items-center justify-between">
              <Button aria-label="Previous slide" disabled={index === 0} onClick={() => setPreviewIndex(index - 1)} size="icon" variant="ghost">
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Button>
              <span className="text-xs text-muted-foreground">Preview slide {index + 1} of {slides.length}</span>
              <Button aria-label="Next slide" disabled={index === slides.length - 1} onClick={() => setPreviewIndex(index + 1)} size="icon" variant="ghost">
                <ChevronRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      {tab === "json" && parsed.kind === "invalid" ? (
        <p className="rounded-[10px] bg-[#E04E2B]/10 p-2.5 text-xs text-[#B3361A]">Invalid JSON: {parsed.message}</p>
      ) : null}

      {result && !generating ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-primary">
            {slideLabel} built · {errorCount} error{errorCount === 1 ? "" : "s"} · {result.warnings.length} warning{result.warnings.length === 1 ? "" : "s"}
          </p>
          {[...result.errors.map((issue) => ({ ...issue, level: "error" as const })), ...result.warnings.map((issue) => ({ ...issue, level: "warning" as const }))].map((issue, issueIndex) => (
            <button
              className={cn(
                "cursor-pointer rounded-lg p-2 text-left text-[11px] leading-snug",
                issue.level === "error" ? "bg-[#E04E2B]/10 text-[#B3361A]" : "bg-surface-03 text-muted-foreground",
              )}
              key={issueIndex}
              onClick={() => {
                const slideIndex = Number(/^slides\[(\d+)\]/.exec(issue.path)?.[1]);
                if (Number.isInteger(slideIndex)) setPreviewIndex(slideIndex);
              }}
              type="button"
            >
              {issue.path ? <span className="font-mono">{issue.path}</span> : null}
              {issue.path ? " — " : null}
              {issue.message}
            </button>
          ))}
        </div>
      ) : null}
    </GeneratorDialog>
  );
}
