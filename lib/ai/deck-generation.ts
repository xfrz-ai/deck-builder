import { isRecord, requestDeckGeneration } from "@/lib/ai/bridge-client";
import { buildDeckFromSpec } from "@/lib/deck-spec/build-deck";
import type { DeckBuildResult, DeckTextMeasure } from "@/lib/deck-spec/deck-spec";
import { getDeckSpecCatalog } from "@/lib/deck-spec/layout-catalog";
import type { SourceDocument } from "@/lib/deck-spec/source-document";

// How many times Claude may fix the problems the builder finds.
const MAX_FIXES = 2;

export type DeckGenerationMode = "restyle" | "rewrite";

export type DeckGenerationStage =
  | { kind: "drafting" }
  | { kind: "fixing"; attempt: number; problems: number };

export interface DeckGenerationResult {
  spec: Record<string, unknown> & { slides: unknown[] };
  notes: string[];
  build: DeckBuildResult;
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function isSpec(value: unknown): value is DeckGenerationResult["spec"] {
  return isRecord(value) && Array.isArray(value.slides) && value.slides.length > 0;
}

// Drafts a deck spec from a document with Claude, then lets Claude fix what
// the builder rejects (text that does not fit, wrong item counts) using the
// same checks as the import preview.
export async function generateDeckSpec({
  document,
  measure,
  mode,
  onStage,
  signal,
}: {
  document: SourceDocument;
  measure: DeckTextMeasure;
  mode: DeckGenerationMode;
  onStage: (stage: DeckGenerationStage) => void;
  signal: AbortSignal;
}): Promise<DeckGenerationResult> {
  const catalog = getDeckSpecCatalog();
  const today = localDate();
  onStage({ kind: "drafting" });
  const draft = await requestDeckGeneration({
    source: { kind: document.kind, name: document.name, text: document.text },
    mode,
    catalog,
    today,
  }, signal);
  if (!isSpec(draft.spec)) throw new Error("Claude did not return a deck. Try again.");

  const spec = draft.spec;
  const notes = [...draft.notes];
  for (let attempt = 1; ; attempt++) {
    const build = buildDeckFromSpec(spec, measure);
    if (build.errors.length === 0 || attempt > MAX_FIXES) return { spec, notes, build };

    onStage({ kind: "fixing", attempt, problems: build.errors.length });
    const fix = await requestDeckGeneration({
      catalog,
      today,
      spec,
      errors: build.errors.map((error) => `${error.path}: ${error.message}`),
    }, signal);
    for (const [key, slide] of Object.entries(fix.slides ?? {})) {
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0 && index < spec.slides.length && isRecord(slide)) spec.slides[index] = slide;
    }
    notes.push(...fix.notes);
  }
}
