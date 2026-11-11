import { createAgendaItem, createDefaultAgenda, isAgendaData, MAX_AGENDA_ITEMS } from "@/lib/agenda/agenda-model";
import { createAgendaSlide, getAgendaErrors } from "@/lib/agenda/agenda-elements";
import type { DeckSpecIssue, DeckTextMeasure } from "@/lib/deck-spec/deck-spec";
import { WKND_COLORS } from "@/lib/layouts/layout-elements";
import { createUniqueId } from "@/lib/id";
import { componentTextFits } from "@/lib/text/component-text";
import { createDefaultTable, getTableRowLimit, MAX_TABLE_COLUMNS } from "@/lib/table/table-model";
import { createTeamSlide, getTeamErrors } from "@/lib/team/team-elements";
import { createDefaultTeam, getTeamLimits, isTeamData, teamHasLeader } from "@/lib/team/team-model";
import { createDynamicTimelineSlide, getDynamicTimelineErrors } from "@/lib/timeline/timeline-component-elements";
import { createDefaultTimeline, getTimelinePhaseLimit, isTimelineData } from "@/lib/timeline/timeline-model";
import type { AgendaItem, AgendaVariant } from "@/types/agenda";
import type { Slide } from "@/types/presentation";
import type { TableColumnKind, TableData, TableRow, TableVariant } from "@/types/table";
import type { TeamGroup, TeamPerson, TeamVariant } from "@/types/team";
import type { TimelineData, TimelineVariant } from "@/types/timeline";

export type ComponentLayout =
  | { kind: "agenda"; layoutId: string; variant: AgendaVariant; purpose: string }
  | { kind: "team"; layoutId: string; variant: TeamVariant; purpose: string }
  | { kind: "timeline"; layoutId: string; variant: Exclude<TimelineVariant, "bars">; purpose: string }
  | { kind: "table"; layoutId: string; variant: TableVariant; purpose: string };

export const COMPONENT_LAYOUTS: readonly ComponentLayout[] = [
  { kind: "agenda", layoutId: "wknd-agenda", variant: "schedule", purpose: "Workshop or meeting schedule: sessions with durations, a date, a location and a start time." },
  { kind: "agenda", layoutId: "wknd-agenda-chapters", variant: "chapters", purpose: "Table of contents: numbered chapters with optional page numbers." },
  { kind: "agenda", layoutId: "wknd-agenda-overview", variant: "cards", purpose: "Agenda as cards: topics with a one-line description each." },
  { kind: "agenda", layoutId: "wknd-agenda-spotlight", variant: "spotlight", purpose: "Section divider that lists all topics and highlights the current one. Reuse it before each section." },
  { kind: "team", layoutId: "wknd-team-structure", variant: "structure", purpose: "Team structure: connected team cards with members." },
  { kind: "team", layoutId: "wknd-team-squads", variant: "squads", purpose: "Squads: team cards with member photos, names and roles." },
  { kind: "team", layoutId: "wknd-team-org", variant: "org", purpose: "Org chart: one leader above team cards." },
  { kind: "team", layoutId: "wknd-team-tree", variant: "tree", purpose: "Org tree: one leader above team leads." },
  { kind: "timeline", layoutId: "wknd-timeline-road", variant: "road", purpose: "Project timeline as milestones on a winding road." },
  { kind: "timeline", layoutId: "wknd-timeline-steps", variant: "steps", purpose: "Project phases as steps that build up." },
  { kind: "timeline", layoutId: "wknd-timeline-roadmap", variant: "roadmap", purpose: "Roadmap across months or quarters." },
  { kind: "table", layoutId: "wknd-table-packages", variant: "packages", purpose: "Pricing or package comparison: features in rows, packages in columns, one highlighted." },
  { kind: "table", layoutId: "wknd-table-scope", variant: "scope", purpose: "Scope of work: services in rows, phases in columns, each cell Lead, Support or —." },
  { kind: "table", layoutId: "wknd-table-bug-triage", variant: "triage", purpose: "Bug or issue list grouped by severity, with steps, expected vs. actual and status." },
];

export interface ComponentContext {
  measure: DeckTextMeasure;
  errors: DeckSpecIssue[];
  warnings: DeckSpecIssue[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown) {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function list(value: unknown, path: string, min: number, max: number, noun: string, context: ComponentContext): unknown[] | null {
  if (!Array.isArray(value)) {
    context.errors.push({ path, message: `Add ${noun} as an array of ${min === max ? min : `${min}–${max}`} items.` });
    return null;
  }
  if (value.length < min || value.length > max) {
    context.errors.push({ path, message: `This layout fits ${min === max ? min : `${min}–${max}`} ${noun}; got ${value.length}.` });
    return null;
  }
  return value;
}

// Maps the form's error keys ("<id>.<field>" or "<field>") to spec paths.
function reportErrors(errors: Record<string, string>, paths: ReadonlyMap<string, string>, base: string, context: ComponentContext) {
  for (const [key, message] of Object.entries(errors)) {
    const [id, field] = key.includes(".") ? key.split(".", 2) : [key, ""];
    const path = paths.get(id) ?? `${base}.${id}`;
    context.errors.push({ path: field ? `${path}.${field}` : path, message });
  }
}

// The header text is laid out once and never reflows, so check that the
// title and intro fit their boxes (the forms leave this to the canvas).
function checkHeaderText(slide: Slide, componentId: string, path: string, context: ComponentContext) {
  for (const field of ["title", "intro"] as const) {
    const element = slide.elements.find((item) => item.id === `${componentId}-${field}`);
    if (element?.type === "text" && !componentTextFits(element, context.measure)) {
      const lines = Math.max(1, Math.floor((element.height + 0.5) / (element.fontSize * element.lineHeight)));
      context.errors.push({ path: `${path}.${field}`, message: `Too long for this layout: it must fit ${lines} line${lines === 1 ? "" : "s"}. Shorten it.` });
    }
  }
}

// Optional pill label, title and intro shared by every component header.
function header<T extends { label: string; title: string; intro: string; introMode: "auto" | "custom" }>(data: T, content: Record<string, unknown>): T {
  return {
    ...data,
    ...(content.eyebrow !== undefined ? { label: str(content.eyebrow) } : {}),
    ...(str(content.title) ? { title: str(content.title) } : {}),
    ...(str(content.intro) ? { intro: str(content.intro), introMode: "custom" as const } : {}),
  };
}

function buildAgenda(layout: Extract<ComponentLayout, { kind: "agenda" }>, content: Record<string, unknown>, path: string, context: ComponentContext): Slide | null {
  const items = list(content.items, `${path}.items`, 1, MAX_AGENDA_ITEMS, "agenda items", context);
  if (!items) return null;
  const data = header(createDefaultAgenda(layout.variant), content);
  const paths = new Map<string, string>([["items", `${path}.items`], ["startTime", `${path}.startTime`], ["activeItem", `${path}.items`]]);
  data.items = items.map((raw, index): AgendaItem => {
    const item = isRecord(raw) ? raw : { title: raw };
    const id = createUniqueId("element");
    paths.set(id, `${path}.items[${index}]`);
    return {
      ...createAgendaItem(id),
      title: str(item.title),
      description: str(item.description),
      page: str(item.page),
      durationMinutes: typeof item.durationMinutes === "number" ? Math.round(item.durationMinutes) : 30,
      kind: item.kind === "break" ? "break" : "session",
      highlighted: item.highlighted === true,
    };
  });
  if (layout.variant === "spotlight" && !data.items.some((item) => item.highlighted)) data.items[0].highlighted = true;
  if (str(content.date)) data.date = str(content.date);
  if (content.location !== undefined) data.location = str(content.location);
  if (str(content.startTime)) data.startTime = str(content.startTime);
  if (!isAgendaData(data)) {
    context.errors.push({ path, message: "The agenda content has the wrong shape." });
    return null;
  }
  reportErrors(getAgendaErrors(data, context.measure), paths, path, context);
  const slide = createAgendaSlide(data, createUniqueId("slide"), context.measure);
  checkHeaderText(slide, data.id, path, context);
  return slide;
}

function buildTeam(layout: Extract<ComponentLayout, { kind: "team" }>, content: Record<string, unknown>, path: string, context: ComponentContext): Slide | null {
  const limits = getTeamLimits(layout.variant);
  const groups = list(content.groups, `${path}.groups`, 1, limits.groups, "teams", context);
  if (!groups) return null;
  const data = header(createDefaultTeam(layout.variant), content);
  const paths = new Map<string, string>([["groups", `${path}.groups`], ["leader", `${path}.leader`]]);
  // Placeholder portraits from the WKND set, so the slide looks finished.
  let photo = 0;
  const portrait = () => {
    const index = photo++ % 9;
    return { src: `/assets/img-people/Placeholder${index === 0 ? "" : `-${index}`}.png`, width: 189, height: 235 };
  };
  const parsed: TeamGroup[] = [];
  for (const [groupIndex, raw] of groups.entries()) {
    const groupPath = `${path}.groups[${groupIndex}]`;
    if (!isRecord(raw)) {
      context.errors.push({ path: groupPath, message: "Each team needs a name and a members array." });
      return null;
    }
    const members = list(raw.members, `${groupPath}.members`, 1, limits.members, "members per team", context);
    if (!members) return null;
    const id = createUniqueId("component");
    paths.set(id, groupPath);
    parsed.push({
      id,
      name: str(raw.name),
      description: str(raw.description),
      members: members.map((member, memberIndex): TeamPerson => {
        const person = isRecord(member) ? member : { name: member };
        const memberId = createUniqueId("element");
        paths.set(memberId, `${groupPath}.members[${memberIndex}]`);
        return { id: memberId, name: str(person.name) || "Full Name", role: str(person.role), photo: portrait() };
      }),
    });
  }
  data.groups = parsed;
  if (teamHasLeader(layout.variant) && data.leader) {
    if (isRecord(content.leader)) {
      data.leader = {
        ...data.leader,
        name: str(content.leader.name) || data.leader.name,
        role: str(content.leader.role) || data.leader.role,
        badge: content.leader.badge !== undefined ? str(content.leader.badge) : data.leader.badge,
      };
    } else {
      context.warnings.push({ path: `${path}.leader`, message: "No leader given; the placeholder leader is shown." });
    }
  }
  if (!isTeamData(data)) {
    context.errors.push({ path, message: "The team content has the wrong shape." });
    return null;
  }
  reportErrors(getTeamErrors(data, context.measure), paths, path, context);
  const slide = createTeamSlide(data, createUniqueId("slide"), context.measure);
  checkHeaderText(slide, data.id, path, context);
  return slide;
}

function buildTimeline(layout: Extract<ComponentLayout, { kind: "timeline" }>, content: Record<string, unknown>, path: string, context: ComponentContext): Slide | null {
  const phases = list(content.phases, `${path}.phases`, 1, getTimelinePhaseLimit(layout.variant), "phases", context);
  if (!phases) return null;
  const data = header(createDefaultTimeline(layout.variant), content);
  if (str(content.title)) data.autoTitle = false;
  const formats: readonly TimelineData["periodFormat"][] = ["weeks", "dates", "months"];
  const format = formats.find((item) => item === content.periodFormat);
  if (format) data.periodFormat = format;
  const paths = new Map<string, string>([["phases", `${path}.phases`]]);
  data.phases = phases.map((raw, index) => {
    const phase = isRecord(raw) ? raw : { title: raw };
    const id = createUniqueId("element");
    paths.set(id, `${path}.phases[${index}]`);
    return { id, title: str(phase.title), description: str(phase.description), start: str(phase.start), end: str(phase.end) };
  });
  if (!isTimelineData(data)) {
    context.errors.push({ path, message: "The timeline content has the wrong shape." });
    return null;
  }
  reportErrors(getDynamicTimelineErrors(data, context.measure), paths, path, context);
  // The first and lowest step has no room for a description.
  if (layout.variant === "steps" && data.phases[0]?.description) {
    context.warnings.push({ path: `${path}.phases[0].description`, message: "The first step of this layout has no room for a description, so it is not shown." });
  }
  const slide = createDynamicTimelineSlide(data, createUniqueId("slide"), context.measure);
  checkHeaderText(slide, data.id, path, context);
  return slide;
}

const ROLE_VALUES: Record<string, string> = { lead: "Lead", support: "Support", "": "—", "-": "—", "—": "—", none: "—" };
const CHECK_VALUES: Record<string, string> = { "✓": "✓", yes: "✓", true: "✓", "—": "—", "-": "—", no: "—", false: "—", "": "—" };
const STATUS_VALUES: Record<string, string> = { open: "Open", "in progress": "In progress", fixed: "Fixed" };
const GROUP_COLORS = [WKND_COLORS.orange, WKND_COLORS.yellow, WKND_COLORS.blue] as const;

// Packages and scope: a header row of columns, then rows of cell text. The
// first column labels the rows.
function buildGridTable(table: TableData, content: Record<string, unknown>, path: string, context: ComponentContext): TableData | null {
  const columns = list(content.columns, `${path}.columns`, 2, MAX_TABLE_COLUMNS, "columns", context);
  const rows = list(content.rows, `${path}.rows`, 1, getTableRowLimit(table.variant), "rows", context);
  if (!columns || !rows) return null;
  const kind: TableColumnKind = table.variant === "packages" ? "comparison" : "role";
  const parsedColumns = columns.map((raw, index) => {
    const column = isRecord(raw) ? raw : { title: raw };
    return { id: `${table.id}-column-${index}`, title: str(column.title), subtitle: str(column.subtitle), kind: index === 0 ? "text" as const : kind };
  });
  const parsedRows: TableRow[] = [];
  for (const [rowIndex, raw] of rows.entries()) {
    const rowPath = `${path}.rows[${rowIndex}]`;
    if (!Array.isArray(raw) || raw.length !== parsedColumns.length) {
      context.errors.push({ path: rowPath, message: `Each row is an array with one text per column (${parsedColumns.length}).` });
      return null;
    }
    parsedRows.push({
      id: `${table.id}-row-${rowIndex}`,
      cells: Object.fromEntries(parsedColumns.map((column, index) => {
        let value = str(raw[index]);
        if (index > 0 && table.variant === "scope") {
          const role = ROLE_VALUES[value.toLowerCase()];
          if (!role) context.errors.push({ path: `${rowPath}[${index}]`, message: "Use \"Lead\", \"Support\" or \"—\"." });
          value = role ?? "—";
        }
        if (index > 0 && table.variant === "packages") value = CHECK_VALUES[value.toLowerCase()] ?? value;
        return [column.id, { value, detail: "", secondary: "" }];
      })),
    });
  }
  const highlight = content.highlightColumn;
  let highlightedColumnId: string | undefined;
  if (table.variant === "packages" && highlight !== undefined && highlight !== null) {
    if (typeof highlight !== "number" || !Number.isInteger(highlight) || highlight < 1 || highlight >= parsedColumns.length) {
      context.errors.push({ path: `${path}.highlightColumn`, message: `Use a column index from 1 to ${parsedColumns.length - 1}, or leave it out.` });
    } else highlightedColumnId = parsedColumns[highlight].id;
  }
  return {
    ...table,
    columns: parsedColumns,
    rows: parsedRows,
    columnCount: parsedColumns.length,
    rowCount: parsedRows.length,
    highlightedColumnId,
    badge: str(content.badge) || table.badge,
  };
}

// Triage: issues grouped by severity, in the fixed five columns.
function buildTriageTable(table: TableData, content: Record<string, unknown>, path: string, context: ComponentContext): TableData | null {
  const groups = list(content.groups, `${path}.groups`, 1, GROUP_COLORS.length, "severity groups", context);
  if (!groups) return null;
  const [idColumn, issueColumn, stepsColumn, expectedColumn, statusColumn] = table.columns;
  const parsedGroups: TableData["groups"] = [];
  const rows: TableRow[] = [];
  for (const [groupIndex, raw] of groups.entries()) {
    const groupPath = `${path}.groups[${groupIndex}]`;
    if (!isRecord(raw) || !Array.isArray(raw.rows) || raw.rows.length < 1) {
      context.errors.push({ path: groupPath, message: "Each group needs a label and at least one row." });
      return null;
    }
    const groupId = `${table.id}-group-${groupIndex}`;
    parsedGroups.push({ id: groupId, label: str(raw.label) || `Group ${groupIndex + 1}`, color: GROUP_COLORS[groupIndex] });
    for (const [rowIndex, rawRow] of raw.rows.entries()) {
      const row = isRecord(rawRow) ? rawRow : {};
      const status = STATUS_VALUES[str(row.status).toLowerCase()];
      if (!status) context.errors.push({ path: `${groupPath}.rows[${rowIndex}].status`, message: "Use \"Open\", \"In progress\" or \"Fixed\"." });
      const cell = (value: unknown, detail: unknown = "", secondary: unknown = "") => ({ value: str(value), detail: str(detail), secondary: str(secondary) });
      rows.push({
        id: `${table.id}-row-${rows.length}`,
        groupId,
        cells: {
          [idColumn.id]: cell(row.id),
          [issueColumn.id]: cell(row.issue, row.impact),
          [stepsColumn.id]: cell(Array.isArray(row.steps) ? row.steps.map((step, index) => `${index + 1}. ${str(step)}`).join("\n") : row.steps),
          [expectedColumn.id]: cell(row.expected, "", row.actual),
          [statusColumn.id]: cell(status ?? "Open"),
        },
      });
    }
  }
  const limit = getTableRowLimit("triage");
  if (rows.length > limit) {
    context.errors.push({ path: `${path}.groups`, message: `This layout fits up to ${limit} rows in total; got ${rows.length}.` });
    return null;
  }
  return { ...table, groups: parsedGroups, rows, rowCount: rows.length };
}

// Builds the table for a template whose table id is `tableId`.
export function buildTableData(variant: TableVariant, tableId: string, content: Record<string, unknown>, path: string, context: ComponentContext) {
  const table = createDefaultTable(variant, tableId);
  if (!isRecord(content.table)) {
    context.errors.push({ path: `${path}.table`, message: "Add the table content." });
    return null;
  }
  return variant === "triage"
    ? buildTriageTable(table, content.table, `${path}.table`, context)
    : buildGridTable(table, content.table, `${path}.table`, context);
}

export function buildComponentSlide(layout: Exclude<ComponentLayout, { kind: "table" }>, content: Record<string, unknown>, path: string, context: ComponentContext): Slide | null {
  switch (layout.kind) {
    case "agenda": return buildAgenda(layout, content, path, context);
    case "team": return buildTeam(layout, content, path, context);
    case "timeline": return buildTimeline(layout, content, path, context);
  }
}
