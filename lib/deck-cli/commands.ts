// Every wknd-deck command, with the one-line summary that `--help` and the
// skill's command table show. This registry is the single source for both.

import {
  CliError, assertId, newRequestId,
  type DeckApi, type DeckDetail, type DeckSummary, type Issue, type RunStore, type SlideDetail,
} from "./api";
import { GUIDE_TOPICS, readGuide, type GuidePaths } from "./guide";

export interface CliContextApi {
  api: DeckApi;
  runs: RunStore;
  guide: GuidePaths;
  // A file path, or "-" for stdin.
  readInput(source: string): Promise<string>;
  openUrl(url: string): Promise<void>;
  // Progress lines during long commands; hidden with --json.
  progress(line: string): void;
}

export type OptionValues = Record<string, string | boolean | undefined>;
export interface CommandResult { data: Record<string, unknown>; text: string; exitCode?: number }
export type CommandGroup = "Read" | "Check" | "Build and change";

export interface CommandDefinition {
  name: string;
  group: CommandGroup;
  usage: string;
  summary: string;
  help?: string;
  // A variadic argument is last and takes every remaining word.
  args: { name: string; optional?: boolean; variadic?: boolean }[];
  options?: Record<string, { type: "string" | "boolean"; description: string }>;
  run(ctx: CliContextApi, args: string[], options: OptionValues): Promise<CommandResult>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJson(text: string, what: string): unknown {
  try { return JSON.parse(text); }
  catch (error) { throw new CliError("INVALID_JSON", `${what} is not valid JSON: ${(error as Error).message}`, [], 2); }
}

// A spec is inline JSON (it starts with "{"), a file path, or "-" for stdin.
// Inline JSON and files work under agent permission rules that block heredocs.
const readSpec = async (ctx: CliContextApi, source: string, what = "The spec") =>
  parseJson(source.trimStart().startsWith("{") ? source : await ctx.readInput(source), what);

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

function oneLine(text: string, max = 48) {
  const line = text.replace(/\s*\n\s*/g, " / ").replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

async function getDeck(ctx: CliContextApi, deckId: string) {
  return ctx.api.call<DeckDetail>("get_deck", { deckId: assertId(deckId, "deck") });
}

// Slide ids are long; output shows the first block, which is unique within a
// deck in practice and is accepted back as a reference.
function shortId(id: string) {
  const match = /^(slide-[0-9a-f]{8})-[0-9a-f-]+$/.exec(id);
  return match ? match[1] : id;
}

// A slide is named by its id, a unique start of its id, or its number in the
// deck (1 = first).
function resolveSlide(deck: { deckId: string; slides: { id: string }[] }, ref: string) {
  if (/^\d+$/.test(ref)) {
    const slide = deck.slides[Number(ref) - 1];
    if (!slide) throw new CliError("SLIDE_NOT_FOUND", `The deck has ${plural(deck.slides.length, "slide")}, so there is no slide ${ref}.`);
    return slide.id;
  }
  assertId(ref, "slide");
  const exact = deck.slides.find(slide => slide.id === ref);
  if (exact) return exact.id;
  const matches = deck.slides.filter(slide => slide.id.startsWith(ref));
  if (matches.length === 1) return matches[0].id;
  throw new CliError("SLIDE_NOT_FOUND", matches.length
    ? `"${ref}" matches ${matches.length} slides. Use the full slide id or its number.`
    : `Slide ${ref} is not in ${deck.deckId}. Run \`wknd-deck deck show ${deck.deckId}\` for the slides.`);
}

const position = (deck: { slides: { id: string }[] }, slideId: string) => deck.slides.findIndex(slide => slide.id === slideId) + 1;

// Template slides show their own content; the layout's built-in texts (logo
// labels, default intros) would only mislead. Hand-edited slides show their text.
function slideTitle(slide: SlideDetail) {
  const content = slide.source && !slide.source.stale ? slide.source.spec.content : undefined;
  if (slide.source && !slide.source.stale) {
    for (const key of ["title", "eyebrow", "subtitle"]) {
      if (typeof content?.[key] === "string" && content[key]) return oneLine(content[key] as string);
    }
    return "";
  }
  const text = slide.texts.find(item => item.text.trim());
  return text ? oneLine(text.text) : "";
}

const isManual = (slide: SlideDetail) => !slide.source || slide.source.stale;

const PLACEHOLDER = /\[[^\]\n]{1,40}\]/g;

function placeholders(deck: DeckDetail) {
  return deck.slides.flatMap((slide, index) => {
    const found = [...new Set(slide.texts.flatMap(item => item.text.match(PLACEHOLDER) ?? []))];
    return found.length ? [{ slide: index + 1, placeholders: found }] : [];
  });
}

// "slides[2].content.title" → "slide 3 (wknd-bento-grid) · content.title"
function issueLines(issues: Issue[], layouts: (string | undefined)[] = []) {
  return issues.map(issue => {
    // The builder lists all 31 ids here; the agent can ask for them instead.
    const message = issue.message.replace(/ Use one of: .*$/, " Run `wknd-deck layouts` for the ids.");
    const match = /^slides\[(\d+)\]\.?(.*)$/.exec(issue.path);
    if (!match) return `  ${issue.path ? `${issue.path}: ` : ""}${message}`;
    const index = Number(match[1]);
    const layout = layouts[index] ? ` (${layouts[index]})` : "";
    return `  slide ${index + 1}${layout}${match[2] ? ` · ${match[2]}` : ""}: ${message}`;
  });
}

// Live runs block other writers. The CLI continues its own runs, and when a
// run was interrupted (service restart, or idle for 10 minutes) it starts a
// fresh one so the change still lands safely.
async function ownerFor(ctx: CliContextApi, deck: { deckId: string; revision: number; agentWork?: DeckSummary["agentWork"] }) {
  const work = deck.agentWork;
  if (!work || (work.status !== "working" && work.status !== "interrupted")) return { owner: {}, temporary: false };
  const stored = await ctx.runs.get(deck.deckId);
  if (work.status === "working") {
    if (stored?.runId === work.id) return { owner: { runId: stored.runId, ownerToken: stored.ownerToken }, temporary: false };
    throw new CliError("DECK_BUSY", "Another agent is working on this deck right now. Wait until it finishes, then try again.");
  }
  const ours = stored?.runId === work.id ? stored : undefined;
  const started = await ctx.api.call<DeckSummary>("start_deck_run", {
    deckId: deck.deckId, expectedRevision: deck.revision, requestId: newRequestId(),
    ...(ours?.plannedSlides ? { plannedSlides: ours.plannedSlides } : {}),
  });
  if (!started.agentWork || !started.ownerToken) throw new CliError("RUN_NOT_STARTED", "Could not take over the interrupted run on this deck.");
  const run = { runId: started.agentWork.id, ownerToken: started.ownerToken, plannedSlides: ours?.plannedSlides };
  if (ours) await ctx.runs.set(deck.deckId, run);
  deck.revision = started.revision;
  return { owner: { runId: run.runId, ownerToken: run.ownerToken }, temporary: !ours };
}

// The service speaks to every client in tool-call terms (slideSpec,
// replaceManual, runId); these are the errors a CLI user can still hit, told
// in commands and flags.
function inCliTerms(error: unknown, deck: DeckDetail, args: Record<string, unknown>) {
  if (!(error instanceof CliError)) return error;
  if (error.code === "SLIDE_SOURCE_STALE") {
    const index = deck.slides.findIndex(slide => slide.id === args.slideId);
    const slide = index < 0 ? "<slide>" : String(index + 1);
    return new CliError(error.code, `Slide ${slide} was edited by hand, so it is not replaced unless the user asked for it. If they did, read its current text with \`wknd-deck slide show ${deck.deckId} ${slide}\`, then run \`wknd-deck slide update ${deck.deckId} ${slide} --spec '<complete slide spec>' --replace-manual\`.`, error.issues);
  }
  if (error.code === "WORK_OWNER_REQUIRED" || error.code === "WORK_BUSY") {
    return new CliError("DECK_BUSY", "Another agent is working on this deck right now. Wait until it finishes, then try again.", error.issues);
  }
  return error;
}

// Applies one change with the deck's current revision, and retries once if
// someone saved in between.
async function editDeck(ctx: CliContextApi, deck: DeckDetail, tool: string, args: Record<string, unknown>) {
  for (let attempt = 0; ; attempt++) {
    const { owner, temporary } = await ownerFor(ctx, deck);
    try {
      const result = await ctx.api.call<DeckSummary>(tool, { deckId: deck.deckId, expectedRevision: deck.revision, requestId: newRequestId(), ...owner, ...args });
      if (temporary) {
        return await ctx.api.call<DeckSummary>("finish_deck", { deckId: deck.deckId, expectedRevision: result.revision, requestId: newRequestId(), ...owner, status: "completed" });
      }
      return result;
    } catch (error) {
      if (error instanceof CliError && error.code === "REVISION_CONFLICT" && attempt === 0) {
        Object.assign(deck, await getDeck(ctx, deck.deckId));
        continue;
      }
      throw inCliTerms(error, deck, args);
    }
  }
}

// The example's structure without its filler text, to keep the output short.
function shortened(value: unknown): unknown {
  if (typeof value === "string") return value.length > 24 ? `${value.slice(0, 20)}…` : value;
  if (Array.isArray(value)) return value.map(shortened);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shortened(item)]));
  return value;
}

function layoutField(name: string, field: Record<string, unknown>, indent: string): string[] {
  const required = field.required === true || Number(field.minItems ?? 0) > 0;
  const parts: string[] = [];
  if (field.type === "array") {
    const min = Number(field.minItems ?? 0);
    const max = field.maxItems;
    const counts = Array.isArray(field.allowedCounts) ? field.allowedCounts.join(", ").replace(/, (\d+)$/, " or $1") : undefined;
    parts.push(counts ? `${counts} items` : min === max ? `exactly ${min} items` : `${min}–${max ?? "any"} items`);
  }
  if (typeof field.maxChars === "number") {
    const lines = Number(field.maxLines ?? 1);
    parts.push(`≤ ${field.maxChars} chars · ${plural(lines, "line")}${lines > 1 ? ` (≈${Math.floor(field.maxChars / lines)} per line)` : ""}`);
  }
  if (Array.isArray(field.enum)) parts.push(`one of ${field.enum.join(", ")}`);
  if (typeof field.description === "string") parts.push(field.description);
  const label = `${indent}${name}${required ? "*" : ""}`;
  const lines = [`${label.padEnd(26)} ${parts.join(". ")}`.trimEnd()];
  const items = field.items;
  if (isRecord(items) && typeof items.type !== "string") {
    for (const [child, value] of Object.entries(items)) if (isRecord(value)) lines.push(...layoutField(child, value, `${indent}  `));
  } else if (isRecord(items) && typeof items.description === "string") {
    lines.push(`${indent}  (each item) ${items.description}`);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const guide: CommandDefinition = {
  name: "guide", group: "Read",
  usage: "guide [topic...]",
  summary: `Print this guide, or one or more references: ${GUIDE_TOPICS.map(topic => `\`${topic}\``).join(", ")}`,
  args: [{ name: "topic", optional: true, variadic: true }],
  async run(ctx, topics) {
    const texts = topics.length ? await Promise.all(topics.map(topic => readGuide(ctx.guide, topic))) : [await readGuide(ctx.guide)];
    const text = texts.join("\n\n---\n\n");
    return { data: { topics, text }, text };
  },
};

const layouts: CommandDefinition = {
  name: "layouts", group: "Read",
  usage: "layouts [--category <name>] [--shape <shape>]",
  summary: "List the templates: id, purpose and shapes, one per line",
  help: "A category says what a template is for; a shape says what it looks like. When the user asks for a look, such as \"two columns with text and a photo\", filter by shape.",
  args: [],
  options: {
    category: { type: "string", description: "Only one category, such as cover, agenda, bento, image, stats, text, timeline, team or table" },
    shape: { type: "string", description: "Only templates with this look, such as text-image, two-column, numbers or statement" },
  },
  async run(ctx, _args, options) {
    const category = options.category as string | undefined;
    const shape = options.shape as string | undefined;
    const catalog = await ctx.api.call<{ shapes?: Record<string, string>; layouts: { id: string; category: string; purpose: string; shapes?: string[] }[] }>("list_layouts", {});
    const shapes = catalog.shapes ?? {};
    const categories = [...new Set(catalog.layouts.map(layout => layout.category))];
    if (category && !categories.includes(category)) throw new CliError("UNKNOWN_CATEGORY", `No templates in category "${category}". Categories: ${categories.join(", ")}.`, [], 2);
    if (shape && !Object.hasOwn(shapes, shape)) throw new CliError("UNKNOWN_SHAPE", `Unknown shape "${shape}". Shapes: ${Object.keys(shapes).join(", ")}.`, [], 2);
    const chosen = catalog.layouts.filter(layout => (!category || layout.category === category) && (!shape || layout.shapes?.includes(shape)));
    const groups = new Map<string, string[]>();
    for (const layout of chosen) {
      const line = `  ${layout.id.padEnd(26)} ${layout.purpose}${layout.shapes?.length ? ` [${layout.shapes.join(", ")}]` : ""}`;
      groups.set(layout.category, [...(groups.get(layout.category) ?? []), line]);
    }
    const text = chosen.length
      ? [...groups].map(([name, lines]) => `${name}\n${lines.join("\n")}`).join("\n\n")
      : `No ${category} template has the shape "${shape}". Run \`wknd-deck layouts --shape ${shape}\` to see it in other categories.`;
    const shapeLines = Object.entries(shapes).map(([name, description]) => `  ${name.padEnd(14)} ${description}`);
    return {
      data: { layouts: chosen.map(({ id, category: group, purpose, shapes: looks }) => ({ id, category: group, purpose, shapes: looks ?? [] })) },
      text: [
        text,
        "",
        "Run `wknd-deck layouts show <layout>` for a template's fields and limits.",
        ...(shape ? [] : ["", "Shapes (filter with --shape <shape>):", ...shapeLines]),
      ].join("\n"),
    };
  },
};

const layoutsShow: CommandDefinition = {
  name: "layouts show", group: "Read",
  usage: "layouts show <layout...>",
  summary: "Fields, limits and an example for one or more templates",
  help: "Name every template you plan to use in one call. Fields marked * are required. Limits are per field: aim for about 85% of each, and keep every line under its own share.",
  args: [{ name: "layout", variadic: true }],
  async run(ctx, layoutIds) {
    const catalog = await ctx.api.call<{ layouts: Record<string, unknown>[] }>("list_layouts", {});
    const unknown = layoutIds.filter(id => !catalog.layouts.some(layout => layout.id === id));
    if (unknown.length) throw new CliError("UNSUPPORTED_LAYOUT", `Unknown template${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}. Run \`wknd-deck layouts\` for the ids.`, [], 2);
    const chosen = layoutIds.map(id => catalog.layouts.find(layout => layout.id === id)!);
    const text = chosen.map(layout => {
      const fields = isRecord(layout.fields) ? layout.fields : {};
      return [
        `${layout.id} — ${layout.name} (${layout.category})`,
        String(layout.purpose ?? ""),
        ...(Array.isArray(layout.shapes) && layout.shapes.length ? [`Shapes: ${layout.shapes.join(", ")}`] : []),
        "Fields (* = required):",
        ...Object.entries(fields).flatMap(([name, field]) => isRecord(field) ? layoutField(name, field, "  ") : []),
        "Example shape (long texts shortened; --json has the full example):",
        JSON.stringify(shortened(layout.example)),
      ].join("\n");
    }).join("\n\n");
    return { data: { layouts: chosen }, text };
  },
};

const layoutsUsage: CommandDefinition = {
  name: "layouts usage", group: "Read",
  usage: "layouts usage [--decks <count>]",
  summary: "Templates used most in recent decks, to help you vary them",
  args: [],
  options: { decks: { type: "string", description: "How many of the most recently changed decks to count (default 10)" } },
  async run(ctx, _args, options) {
    const decks = options.decks === undefined ? undefined : Number(options.decks);
    if (decks !== undefined && (!Number.isInteger(decks) || decks < 1 || decks > 50)) throw new CliError("INVALID_OPTION", "--decks must be a whole number from 1 to 50.", [], 2);
    const result = await ctx.api.call<{ decks: number; layouts: { layout: string; decks: number; slides: number }[]; unused: string[] }>("layout_usage", decks ? { decks } : {});
    const lines = [
      `Template use in the last ${plural(result.decks, "deck")}:`,
      ...result.layouts.map(item => `  ${item.layout.padEnd(26)} ${plural(item.decks, "deck")}, ${plural(item.slides, "slide")}`),
      "",
      `Not used: ${result.unused.length ? result.unused.join(", ") : "none"}`,
    ];
    return { data: result, text: lines.join("\n") };
  },
};

const brand: CommandDefinition = {
  name: "brand", group: "Read",
  usage: "brand",
  summary: "Themes, palette tokens, fonts and the grid",
  args: [],
  async run(ctx) {
    const result = await ctx.api.call<Record<string, unknown>>("get_brand_styles", {});
    const themes = Array.isArray(result.themes) ? result.themes as Record<string, unknown>[] : [];
    const palette = isRecord(result.palette) ? result.palette : {};
    const grid = isRecord(result.grid) ? result.grid : {};
    const lines = [
      `Font: ${result.fontFamily} · canvas ${result.width}×${result.height}`,
      `Grid: ${grid.columns} columns × ${grid.rows} rows, ${grid.columnWidth}×${grid.rowHeight} px modules, ${grid.gutter} px gutter, margins ${grid.marginX} px (sides) and ${grid.marginY} px (top and bottom)`,
      `Themes: ${themes.map(theme => theme.id).join(", ")}, or none to keep each template's own colors`,
      `Palette: ${Object.entries(palette).map(([name, value]) => `${name} ${value}`).join(", ")}`,
    ];
    return { data: { ...result, themes: themes.map(theme => theme.id) }, text: lines.join("\n") };
  },
};

const decks: CommandDefinition = {
  name: "decks", group: "Read",
  usage: "decks",
  summary: "List decks: id, title, slide count and last change",
  args: [],
  async run(ctx) {
    const result = await ctx.api.call<{ decks: { id: string; title: string; slideCount: number; updatedAt: number; revision: number; agentWork?: { status: string } }[] }>("list_decks", {});
    const list = [...result.decks].sort((a, b) => b.updatedAt - a.updatedAt);
    const text = list.length
      ? list.map(deck => `${deck.id}  "${oneLine(deck.title, 60)}"  ${plural(deck.slideCount, "slide")}  changed ${new Date(deck.updatedAt).toISOString().slice(0, 16).replace("T", " ")}${deck.agentWork?.status === "working" ? "  (an agent is working on it)" : ""}`).join("\n")
      : "No decks yet.";
    return { data: { decks: list }, text };
  },
};

const deckShow: CommandDefinition = {
  name: "deck show", group: "Read",
  usage: "deck show <deck>",
  summary: "List a deck's slides: number, id, layout, title and manual flag, plus its placeholders",
  help: "A slide marked manual was edited by hand in the editor. Don't replace it unless the user asks.",
  args: [{ name: "deck" }],
  async run(ctx, [deckId]) {
    const deck = await getDeck(ctx, deckId);
    const slides = deck.slides.map((slide, index) => ({
      number: index + 1, id: slide.id, layout: slide.source?.spec.layout ?? null, title: slideTitle(slide), manual: isManual(slide),
    }));
    const found = placeholders(deck);
    const lines = [
      `${deck.deckId}  "${deck.title}"  revision ${deck.revision}  theme ${deck.defaults.theme ?? "none"}${deck.agentWork ? `  agent run ${deck.agentWork.status}` : ""}`,
      ...slides.map(slide => `${String(slide.number).padStart(3)}  ${shortId(slide.id)}  ${(slide.layout ?? "—").padEnd(26)} ${slide.title}${slide.manual ? "  (manual)" : ""}`),
      ...(found.length ? ["", "Placeholders:", ...found.map(item => `  slide ${item.slide}: ${item.placeholders.join(", ")}`)] : []),
    ];
    return { data: { deckId: deck.deckId, title: deck.title, revision: deck.revision, theme: deck.defaults.theme ?? null, footer: deck.defaults.footer ?? null, agentWork: deck.agentWork ?? null, slides, placeholders: found }, text: lines.join("\n") };
  },
};

const slideShow: CommandDefinition = {
  name: "slide show", group: "Read",
  usage: "slide show <deck> <slide>",
  summary: "Show one slide's spec, or its text when it was edited by hand",
  args: [{ name: "deck" }, { name: "slide" }],
  async run(ctx, [deckId, slideRef]) {
    const deck = await getDeck(ctx, deckId);
    const slideId = resolveSlide(deck, slideRef);
    const slide = deck.slides.find(item => item.id === slideId)!;
    const number = position(deck, slideId);
    const manual = isManual(slide);
    const lines = [
      `slide ${number}  ${shortId(slide.id)}  ${slide.source?.spec.layout ?? "no template"}${manual ? "  (manual: edited by hand)" : ""}`,
      ...(slide.source ? [JSON.stringify(slide.source.spec)] : []),
      ...(manual ? ["", "Text on the slide now:", ...slide.texts.filter(item => item.text.trim()).map(item => `  ${oneLine(item.text, 100)}`)] : []),
    ];
    return { data: { number, id: slide.id, manual, spec: slide.source?.spec ?? null, texts: slide.texts.map(item => item.text) }, text: lines.join("\n") };
  },
};

const check: CommandDefinition = {
  name: "check", group: "Check",
  usage: "check <spec>",
  summary: "Validate a deck spec or one slide spec without saving anything",
  help: "<spec> is inline JSON in single quotes, a file path, or - to read JSON from stdin. A deck spec has a \"slides\" array; anything else is checked as one slide. Exits with code 1 when the spec has errors.",
  args: [{ name: "spec" }],
  async run(ctx, [source]) {
    const spec = await readSpec(ctx, source);
    const result = await ctx.api.call<{ valid: boolean; kind: "deck" | "slide"; slideCount: number; errors: Issue[]; warnings: Issue[] }>("check_spec", { spec });
    const layouts = isRecord(spec) && Array.isArray(spec.slides) ? spec.slides.map(slide => isRecord(slide) && typeof slide.layout === "string" ? slide.layout : undefined) : [];
    const what = result.kind === "deck" ? `deck spec with ${plural(result.slideCount, "slide")}` : "slide spec";
    const lines = result.valid
      ? [`OK: valid ${what}.`]
      : [`The ${what} has ${plural(result.errors.length, "error")}:`, ...issueLines(result.errors, layouts)];
    if (result.warnings.length) lines.push(`${plural(result.warnings.length, "warning")} (fine to keep):`, ...issueLines(result.warnings.slice(0, 5), layouts), ...(result.warnings.length > 5 ? [`  … see --json for all`] : []));
    const { valid, kind, slideCount, errors, warnings } = result;
    return { data: { valid, kind, slideCount, errors, warnings }, text: lines.join("\n"), exitCode: result.valid ? 0 : 1 };
  },
};

const deckCreate: CommandDefinition = {
  name: "deck create", group: "Build and change",
  usage: "deck create <spec> [--live] [--planned <count>]",
  summary: "Create a deck from a spec. With --live it saves the slides one by one, so the user can watch",
  help: [
    "<spec> is inline JSON in single quotes, a file path, or - to read JSON from stdin.",
    "The whole spec is checked first; when anything fails, nothing is saved.",
    "With --planned larger than the number of slides in the spec, the live run stays open: add the remaining slides with `slide add`, then run `deck finish`.",
  ].join("\n"),
  args: [{ name: "spec" }],
  options: {
    live: { type: "boolean", description: "Save slide by slide, so the deck appears in the Library at once" },
    planned: { type: "string", description: "Total slides you plan, when you will add more after this command (needs --live)" },
  },
  async run(ctx, [source], options) {
    const spec = await readSpec(ctx, source);
    if (!isRecord(spec) || !Array.isArray(spec.slides)) throw new CliError("NOT_A_DECK", "A deck spec needs a \"slides\" array. To add one slide to a deck, use `slide add`.", [], 2);
    const slides = spec.slides as Record<string, unknown>[];
    const checked = await ctx.api.call<{ valid: boolean; errors: Issue[] }>("check_spec", { spec });
    const layouts = slides.map(slide => typeof slide?.layout === "string" ? slide.layout : undefined);
    if (!checked.valid) throw new CliError("CHECK_FAILED", `Nothing was saved: the spec has ${plural(checked.errors.length, "error")}.\n${issueLines(checked.errors, layouts).join("\n")}`, checked.errors);
    const planned = options.planned === undefined ? slides.length : Number(options.planned);
    if (options.planned !== undefined && !options.live) throw new CliError("INVALID_OPTION", "--planned only works with --live.", [], 2);
    if (!Number.isInteger(planned) || planned < slides.length || planned > 60) throw new CliError("INVALID_OPTION", `--planned must be a whole number from ${slides.length} (the slides in this spec) to 60.`, [], 2);

    if (!options.live) {
      const created = await ctx.api.call<DeckSummary>("create_deck", { spec, requestId: newRequestId() });
      return {
        data: { deckId: created.deckId, title: created.title, revision: created.revision, slides: created.slides.map(({ id, layout }) => ({ id, layout })) },
        text: `Created ${created.deckId} "${created.title}" with ${plural(created.slides.length, "slide")}.`,
      };
    }

    const created = await ctx.api.call<DeckSummary>("create_deck", { spec: { ...spec, slides: [slides[0]] }, requestId: newRequestId(), live: true, plannedSlides: planned });
    if (!created.agentWork || !created.ownerToken) throw new CliError("RUN_NOT_STARTED", "The deck was created, but its live run did not start.");
    const run = { runId: created.agentWork.id, ownerToken: created.ownerToken, plannedSlides: planned };
    await ctx.runs.set(created.deckId, run);
    const owner = { runId: run.runId, ownerToken: run.ownerToken };
    ctx.progress(`Building ${created.deckId} "${created.title}", ${plural(planned, "slide")} planned:`);
    ctx.progress(`  1/${planned}  ${layouts[0]}`);
    let revision = created.revision;
    let latest = created;
    for (let index = 1; index < slides.length; index++) {
      try {
        latest = await ctx.api.call<DeckSummary>("add_slide", { deckId: created.deckId, expectedRevision: revision, requestId: newRequestId(), slideSpec: slides[index], ...owner });
      } catch (error) {
        const summary = `Slide ${index + 1} failed; the deck keeps the first ${index}.`;
        await ctx.api.call("finish_deck", { deckId: created.deckId, expectedRevision: revision, requestId: newRequestId(), ...owner, status: "partial", summary }).catch(() => undefined);
        await ctx.runs.delete(created.deckId);
        if (error instanceof CliError) throw new CliError(error.code, `${summary} ${error.message}`, error.issues.map(issue => ({ ...issue, path: issue.path ? `slides[${index}].${issue.path}` : issue.path })));
        throw error;
      }
      revision = latest.revision;
      ctx.progress(`  ${index + 1}/${planned}  ${layouts[index]}`);
    }
    const data = { deckId: created.deckId, title: created.title, revision, slides: latest.slides.map(({ id, layout }) => ({ id, layout })), runOpen: planned > slides.length };
    if (planned > slides.length) {
      return { data, text: `The live run stays open: ${plural(planned - slides.length, "more slide")} planned. Add them with \`wknd-deck slide add ${created.deckId} '<slide spec>'\` or a spec file, then run \`wknd-deck deck finish ${created.deckId}\`.` };
    }
    const finished = await ctx.api.call<DeckSummary>("finish_deck", { deckId: created.deckId, expectedRevision: revision, requestId: newRequestId(), ...owner, status: "completed" });
    await ctx.runs.delete(created.deckId);
    return { data: { ...data, revision: finished.revision }, text: `Created ${created.deckId} "${created.title}" with ${plural(slides.length, "slide")}. It is in the user's Library.` };
  },
};

const deckSet: CommandDefinition = {
  name: "deck set", group: "Build and change",
  usage: "deck set <deck> [--title <text>] [--theme <theme>] [--footer-left <text>] [--footer-note <text>]",
  summary: "Change the deck's title, theme or footer",
  help: "Themes: blue, cream, black, yellow, orange, or none to keep each template's own colors. Template slides are rebuilt with the new theme and footer; slides edited by hand take the new theme and keep their footer.",
  args: [{ name: "deck" }],
  options: {
    title: { type: "string", description: "Deck title, shown in the Library" },
    theme: { type: "string", description: "blue, cream, black, yellow, orange or none" },
    "footer-left": { type: "string", description: "Small text at the bottom left of every slide" },
    "footer-note": { type: "string", description: "Small note at the bottom of every slide, such as Confidential" },
  },
  async run(ctx, [deckId], options) {
    const footer = { ...(options["footer-left"] !== undefined ? { left: options["footer-left"] } : {}), ...(options["footer-note"] !== undefined ? { note: options["footer-note"] } : {}) };
    const changes = {
      ...(options.title !== undefined ? { title: options.title } : {}),
      ...(options.theme !== undefined ? { theme: options.theme } : {}),
      ...(Object.keys(footer).length ? { footer } : {}),
    };
    if (!Object.keys(changes).length) throw new CliError("NOTHING_TO_CHANGE", "Give at least one of --title, --theme, --footer-left or --footer-note.", [], 2);
    const deck = await getDeck(ctx, deckId);
    const result = await editDeck(ctx, deck, "update_deck", changes);
    const manual = result.slides.flatMap((slide, index) => slide.manuallyEdited ? [index + 1] : []);
    const notes = [
      `Updated ${result.deckId}: ${Object.keys(changes).join(", ")}.`,
      ...(manual.length && changes.footer ? [`Slides edited by hand keep their old footer: ${manual.join(", ")}.`] : []),
    ];
    return { data: { deckId: result.deckId, revision: result.revision, changed: Object.keys(changes), manualSlides: manual }, text: notes.join(" ") };
  },
};

const deckFinish: CommandDefinition = {
  name: "deck finish", group: "Build and change",
  usage: "deck finish <deck> [--partial | --failed] [--summary <text>]",
  summary: "Close a live build you left open with --planned",
  help: "Without a flag the build is marked completed, which needs every planned slide. Use --partial when you stop early on purpose, --failed when the build could not go on.",
  args: [{ name: "deck" }],
  options: {
    partial: { type: "boolean", description: "Some planned slides are missing on purpose" },
    failed: { type: "boolean", description: "The build could not be completed" },
    summary: { type: "string", description: "One line for the Library, at most 240 characters" },
  },
  async run(ctx, [deckId], options) {
    if (options.partial && options.failed) throw new CliError("INVALID_OPTION", "Use either --partial or --failed.", [], 2);
    const deck = await getDeck(ctx, deckId);
    const run = await ctx.runs.get(deck.deckId);
    if (!run || deck.agentWork?.id !== run.runId || deck.agentWork.status !== "working") {
      throw new CliError("NO_OPEN_RUN", `There is no open live build of yours on ${deck.deckId}.`);
    }
    const status = options.failed ? "failed" : options.partial ? "partial" : "completed";
    const result = await ctx.api.call<DeckSummary>("finish_deck", {
      deckId: deck.deckId, expectedRevision: deck.revision, requestId: newRequestId(), runId: run.runId, ownerToken: run.ownerToken, status,
      ...(typeof options.summary === "string" ? { summary: options.summary } : {}),
    }).catch(error => {
      if (!(error instanceof CliError) || error.code !== "INCOMPLETE_DECK") throw error;
      throw new CliError(error.code, `${error.message.replace(/ Add the remaining.*$/, "")} Add the missing slides with \`wknd-deck slide add\`, or run \`wknd-deck deck finish ${deck.deckId} --partial\` when they are missing on purpose.`, error.issues);
    });
    await ctx.runs.delete(deck.deckId);
    return { data: { deckId: result.deckId, revision: result.revision, status }, text: `Marked the build of ${result.deckId} as ${status}, with ${plural(result.slides.length, "slide")}.` };
  },
};

const slideAdd: CommandDefinition = {
  name: "slide add", group: "Build and change",
  usage: "slide add <deck> <spec> [--after <slide>]",
  summary: "Add a slide, at the end or after a given slide",
  help: "<spec> is one slide spec ({ \"layout\", \"content\" }), as inline JSON, a file path, or - for stdin. <slide> is a slide id or its number.",
  args: [{ name: "deck" }, { name: "spec" }],
  options: { after: { type: "string", description: "Slide id or number to insert after; the default is the end" } },
  async run(ctx, [deckId, source], options) {
    const slideSpec = await readSpec(ctx, source, "The slide spec");
    if (isRecord(slideSpec) && Array.isArray(slideSpec.slides)) throw new CliError("NOT_A_SLIDE", "This is a deck spec. `slide add` takes one slide: { \"layout\", \"content\" }.", [], 2);
    const deck = await getDeck(ctx, deckId);
    const afterSlideId = typeof options.after === "string" ? resolveSlide(deck, options.after) : undefined;
    const before = new Set(deck.slides.map(slide => slide.id));
    const result = await editDeck(ctx, deck, "add_slide", { slideSpec, ...(afterSlideId ? { afterSlideId } : {}) });
    const added = result.slides.find(slide => !before.has(slide.id))!;
    const number = position(result, added.id);
    return { data: { deckId: result.deckId, revision: result.revision, slide: { number, id: added.id, layout: added.layout } }, text: `Added slide ${number} of ${result.slides.length}: ${shortId(added.id)} (${added.layout}).` };
  },
};

const slideUpdate: CommandDefinition = {
  name: "slide update", group: "Build and change",
  usage: "slide update <deck> <slide> (--patch <json> | --spec <spec>) [--replace-manual]",
  summary: "Change some fields of a slide (--patch), or replace it with a new spec (--spec)",
  help: [
    "--patch takes inline JSON, or - for stdin. It merges into the slide's content: fields you leave out stay, and an array replaces the whole array.",
    "--spec takes a complete slide spec, as inline JSON, a file path, or - for stdin, and can change the layout.",
    "A slide edited by hand only changes with --spec and --replace-manual, and only when the user asked for it.",
  ].join("\n"),
  args: [{ name: "deck" }, { name: "slide" }],
  options: {
    patch: { type: "string", description: "Content fields to change, as JSON" },
    spec: { type: "string", description: "A complete slide spec, as inline JSON, a file path or -" },
    "replace-manual": { type: "boolean", description: "Allow replacing a slide that was edited by hand" },
  },
  async run(ctx, [deckId, slideRef], options) {
    if ((options.patch === undefined) === (options.spec === undefined)) throw new CliError("INVALID_OPTION", "Give exactly one of --patch or --spec.", [], 2);
    if (options["replace-manual"] && options.spec === undefined) throw new CliError("INVALID_OPTION", "--replace-manual needs a complete --spec.", [], 2);
    const change = options.patch !== undefined
      ? { contentPatch: parseJson(options.patch === "-" ? await ctx.readInput("-") : String(options.patch), "--patch") }
      : { slideSpec: await readSpec(ctx, String(options.spec), "The slide spec"), ...(options["replace-manual"] ? { replaceManual: true } : {}) };
    if ("contentPatch" in change && !isRecord(change.contentPatch)) throw new CliError("INVALID_OPTION", "--patch must be a JSON object of content fields.", [], 2);
    const deck = await getDeck(ctx, deckId);
    const slideId = resolveSlide(deck, slideRef);
    const result = await editDeck(ctx, deck, "update_slide", { slideId, ...change });
    const number = position(result, slideId);
    return { data: { deckId: result.deckId, revision: result.revision, slide: { number, id: slideId, layout: result.slides[number - 1].layout } }, text: `Updated slide ${number} (${shortId(slideId)}).` };
  },
};

const slideMove: CommandDefinition = {
  name: "slide move", group: "Build and change",
  usage: "slide move <deck> <slide> (--after <slide> | --first)",
  summary: "Move a slide after another slide, or to the start",
  args: [{ name: "deck" }, { name: "slide" }],
  options: {
    after: { type: "string", description: "Slide id or number to place it after" },
    first: { type: "boolean", description: "Make it the first slide" },
  },
  async run(ctx, [deckId, slideRef], options) {
    if ((options.after === undefined) === !options.first) throw new CliError("INVALID_OPTION", "Give exactly one of --after <slide> or --first.", [], 2);
    const deck = await getDeck(ctx, deckId);
    const slideId = resolveSlide(deck, slideRef);
    const afterSlideId = typeof options.after === "string" ? resolveSlide(deck, options.after) : undefined;
    const result = await editDeck(ctx, deck, "move_slide", { slideId, ...(afterSlideId ? { afterSlideId } : {}) });
    const number = position(result, slideId);
    return { data: { deckId: result.deckId, revision: result.revision, slide: { number, id: slideId } }, text: `Moved ${shortId(slideId)} to position ${number} of ${result.slides.length}.` };
  },
};

const slideDuplicate: CommandDefinition = {
  name: "slide duplicate", group: "Build and change",
  usage: "slide duplicate <deck> <slide>",
  summary: "Copy a slide and place the copy right after it",
  args: [{ name: "deck" }, { name: "slide" }],
  async run(ctx, [deckId, slideRef]) {
    const deck = await getDeck(ctx, deckId);
    const slideId = resolveSlide(deck, slideRef);
    const result = await editDeck(ctx, deck, "duplicate_slide", { slideId });
    const number = position(result, slideId) + 1;
    const copy = result.slides[number - 1];
    return { data: { deckId: result.deckId, revision: result.revision, slide: { number, id: copy.id, layout: copy.layout } }, text: `Copied slide ${number - 1} to slide ${number}: ${shortId(copy.id)}.` };
  },
};

const slideDelete: CommandDefinition = {
  name: "slide delete", group: "Build and change",
  usage: "slide delete <deck> <slide> --yes",
  summary: "Delete a slide, once the user agreed",
  args: [{ name: "deck" }, { name: "slide" }],
  options: { yes: { type: "boolean", description: "Confirms that the user asked for this deletion" } },
  async run(ctx, [deckId, slideRef], options) {
    if (!options.yes) throw new CliError("CONFIRMATION_REQUIRED", "Deleting needs --yes, and only after the user asked for it.", [], 2);
    const deck = await getDeck(ctx, deckId);
    const slideId = resolveSlide(deck, slideRef);
    const number = position(deck, slideId);
    const result = await editDeck(ctx, deck, "delete_slide", { slideId });
    return { data: { deckId: result.deckId, revision: result.revision, deleted: { number, id: slideId }, slideCount: result.slides.length }, text: `Deleted slide ${number} (${shortId(slideId)}). The deck has ${plural(result.slides.length, "slide")} now.` };
  },
};

const open: CommandDefinition = {
  name: "open", group: "Build and change",
  usage: "open <deck>",
  summary: "Open the deck in the editor, when you run in a terminal",
  args: [{ name: "deck" }],
  async run(ctx, [deckId]) {
    const deck = await getDeck(ctx, deckId);
    await ctx.openUrl(deck.editorUrl);
    return { data: { deckId: deck.deckId }, text: `Opened ${deck.deckId} in the editor.` };
  },
};

export const COMMANDS: readonly CommandDefinition[] = [
  guide, layouts, layoutsShow, layoutsUsage, brand, decks, deckShow, slideShow,
  check,
  deckCreate, deckSet, deckFinish, slideAdd, slideUpdate, slideMove, slideDuplicate, slideDelete, open,
];
