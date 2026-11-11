import { estimateTextCapacity } from "@/lib/deck-spec/build-deck";
import { COMPONENT_LAYOUTS, type ComponentLayout } from "@/lib/deck-spec/component-layouts";
import { DECK_SPEC_VERSION } from "@/lib/deck-spec/deck-spec";
import { STATIC_LAYOUT_CONTENT, TABLE_HEADER_FIELDS, type StaticField, type StaticItemField } from "@/lib/deck-spec/static-layouts";
import { createDefaultAgenda, MAX_AGENDA_ITEMS } from "@/lib/agenda/agenda-model";
import { SLIDE_LAYOUTS } from "@/lib/layouts/layout-registry";
import { createDefaultTable, getTableRowLimit, MAX_TABLE_COLUMNS } from "@/lib/table/table-model";
import { createDefaultTeam, getTeamLimits, teamHasLeader } from "@/lib/team/team-model";
import { createDefaultTimeline, getTimelinePhaseLimit } from "@/lib/timeline/timeline-model";
import { DECK_THEMES } from "@/lib/themes/deck-themes";
import type { Slide, TextElement } from "@/types/presentation";

// The agent-facing description of every layout a deck spec can use: what it
// is for, its content fields with their limits, and an example. Served as
// /deck-spec/catalog.json.

type CatalogField = Record<string, unknown>;

interface CatalogLayout {
  id: string;
  name: string;
  category: string;
  purpose: string;
  fields: Record<string, CatalogField>;
  example: Record<string, unknown>;
}

function templateText(slide: Slide, id: string) {
  const element = slide.elements.find((item) => item.id === id);
  return element?.type === "text" ? element : undefined;
}

function describeItemField(field: StaticItemField, slide: Slide, layoutId: string, key: string): { field: CatalogField; example?: unknown } {
  const id = `${layoutId}-${field.element.replaceAll("{n}", key)}`;
  if (field.type === "image") return { field: { type: "image-url", description: field.description } };
  const element = templateText(slide, id) as TextElement | undefined;
  const capacity = element && !field.pill ? estimateTextCapacity(element) : undefined;
  return {
    field: {
      type: field.lines ? "string[]" : "string",
      ...(field.lines ? { items: field.lines } : {}),
      required: Boolean(field.required),
      description: field.description,
      ...(capacity ? { maxChars: capacity.characters, maxLines: capacity.lines } : {}),
    },
    example: element ? (field.lines ? element.text.split("\n") : element.text) : undefined,
  };
}

function describeStaticFields(fields: Record<string, StaticField>, slide: Slide, layoutId: string) {
  const described: Record<string, CatalogField> = {};
  const example: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(fields)) {
    if (field.type !== "list") {
      const result = describeItemField(field, slide, layoutId, "");
      described[key] = result.field;
      if (result.example !== undefined) example[key] = result.example;
      continue;
    }
    const firstKey = field.keys?.[0] ?? "1";
    const items: Record<string, CatalogField> = {};
    for (const [name, itemField] of Object.entries(field.fields)) items[name] = describeItemField(itemField, slide, layoutId, firstKey).field;
    described[key] = { type: "array", minItems: field.min, maxItems: field.max, description: field.description, items };
    example[key] = Array.from({ length: field.max }, (_, index) => {
      const itemKey = field.keys?.[index] ?? String(index + 1);
      return Object.fromEntries(Object.entries(field.fields).flatMap(([name, itemField]) => {
        const value = describeItemField(itemField, slide, layoutId, itemKey).example;
        return value === undefined ? [] : [[name, value]];
      }));
    });
  }
  return { fields: described, example };
}

const HEADER_FIELDS = {
  eyebrow: { type: "string", required: false, description: "Pill label above the title, 1–3 words. Use \"\" to hide it." },
  title: { type: "string", required: false, description: "Slide title. Shrinks to fit; keep it to two short lines." },
  intro: { type: "string", required: false, description: "Intro under the title, one or two lines. Leave out for an automatic one, which is in English: set it when the deck is in another language." },
};

function describeComponent(layout: ComponentLayout, slide: Slide): Pick<CatalogLayout, "fields" | "example"> {
  switch (layout.kind) {
    case "agenda": {
      const data = createDefaultAgenda(layout.variant);
      const itemFields: Record<string, CatalogField> = { title: { type: "string", required: true, description: layout.variant === "schedule" ? "Session title; may use \"\\n\" for a second line. Short sessions only fit short titles." : "One line." } };
      if (layout.variant === "cards" || layout.variant === "spotlight") itemFields.description = { type: "string", description: "One line, under ~40 characters." };
      if (layout.variant === "chapters") itemFields.page = { type: "string", description: "Page number, or leave out." };
      if (layout.variant === "schedule") {
        itemFields.durationMinutes = { type: "integer", description: "Session length in minutes." };
        itemFields.kind = { type: "enum", values: ["session", "break"] };
      }
      if (layout.variant === "spotlight") itemFields.highlighted = { type: "boolean", description: "Exactly one item is the current topic; defaults to the first." };
      const fields: Record<string, CatalogField> = {
        ...(layout.variant === "spotlight" ? { eyebrow: HEADER_FIELDS.eyebrow } : HEADER_FIELDS),
        items: { type: "array", minItems: 1, maxItems: MAX_AGENDA_ITEMS, items: itemFields },
        ...(layout.variant === "schedule" ? {
          date: { type: "string", format: "YYYY-MM-DD" },
          location: { type: "string" },
          startTime: { type: "string", format: "HH:MM (24h)", description: "All sessions must end before midnight." },
        } : {}),
      };
      const example: Record<string, unknown> = {
        ...(layout.variant === "spotlight" ? { eyebrow: data.label } : { eyebrow: data.label, title: data.title }),
        items: data.items.map((item) => Object.fromEntries(Object.keys(itemFields).map((key) => [key, item[key as keyof typeof item]]))),
        ...(layout.variant === "schedule" ? { date: data.date, location: data.location, startTime: data.startTime } : {}),
      };
      return { fields, example };
    }
    case "team": {
      const data = createDefaultTeam(layout.variant);
      const limits = getTeamLimits(layout.variant);
      const leader = teamHasLeader(layout.variant);
      return {
        fields: {
          ...HEADER_FIELDS,
          ...(leader ? { leader: { type: "object", items: { name: { type: "string" }, role: { type: "string" }, badge: { type: "string", description: "Short badge, e.g. \"CEO\"." } } } } : {}),
          groups: {
            type: "array", minItems: 1, maxItems: limits.groups,
            items: {
              name: { type: "string", required: true, description: "1–3 words." },
              description: { type: "string", description: "Under ~40 characters." },
              members: {
                type: "array", minItems: 1, maxItems: limits.members,
                description: leader ? "The first member is shown as the team lead." : undefined,
                items: { name: { type: "string", description: "Leave out to show \"Full Name\"." }, role: { type: "string", description: "Under ~28 characters." } },
              },
            },
          },
        },
        example: {
          eyebrow: data.label,
          title: data.title,
          ...(leader && data.leader ? { leader: { name: data.leader.name, role: data.leader.role, badge: data.leader.badge } } : {}),
          groups: data.groups.map((group) => ({ name: group.name, description: group.description, members: group.members.map((member) => ({ name: member.name, role: member.role })) })),
        },
      };
    }
    case "timeline": {
      const data = createDefaultTimeline(layout.variant);
      return {
        fields: {
          ...(layout.variant === "roadmap" ? { title: HEADER_FIELDS.title, intro: HEADER_FIELDS.intro } : HEADER_FIELDS),
          periodFormat: { type: "enum", values: ["weeks", "dates", "months"], description: "How each phase's period is labelled. Defaults to weeks (months for the roadmap)." },
          phases: {
            type: "array", minItems: 1, maxItems: getTimelinePhaseLimit(layout.variant),
            items: {
              title: { type: "string", required: true, description: "One or two words." },
              description: { type: "string", description: layout.variant === "steps" ? "Up to two short lines. Not shown for the first step." : "Up to two short lines." },
              start: { type: "string", required: true, format: "YYYY-MM-DD" },
              end: { type: "string", required: true, format: "YYYY-MM-DD", description: "On or after start." },
            },
          },
        },
        example: {
          ...(layout.variant === "roadmap" ? { title: "Roadmap 2026" } : { eyebrow: data.label, title: data.title }),
          phases: data.phases.map(({ title, description, start, end }) => ({ title, description, start, end })),
        },
      };
    }
    case "table": {
      const header = describeStaticFields(TABLE_HEADER_FIELDS, slide, layout.layoutId);
      const table = createDefaultTable(layout.variant);
      if (layout.variant === "triage") {
        const groups = table.groups.map((group) => ({
          label: group.label,
          rows: table.rows.filter((row) => row.groupId === group.id).map((row) => {
            const [id, issue, steps, expected, status] = table.columns.map((column) => row.cells[column.id]);
            return { id: id.value, issue: issue.value, impact: issue.detail, steps: steps.value.split("\n").map((step) => step.replace(/^\d+\.\s*/, "")), expected: expected.value, actual: expected.secondary, status: status.value };
          }),
        }));
        return {
          fields: {
            ...header.fields,
            table: {
              type: "object",
              description: `Issues grouped by severity, in order. Up to ${getTableRowLimit("triage")} rows in total.`,
              items: {
                groups: {
                  type: "array", minItems: 1, maxItems: 3, description: "Colored orange, yellow, then blue.",
                  items: {
                    label: { type: "string", description: "Severity, e.g. \"Critical\"." },
                    rows: {
                      type: "array",
                      items: {
                        id: { type: "string", description: "Issue key, e.g. \"BUG-1042\"." },
                        issue: { type: "string", description: "Short issue title." },
                        impact: { type: "string", description: "One sentence on the impact." },
                        steps: { type: "string[]", description: "Steps to reproduce, 2–3 short steps." },
                        expected: { type: "string" },
                        actual: { type: "string" },
                        status: { type: "enum", values: ["Open", "In progress", "Fixed"] },
                      },
                    },
                  },
                },
              },
            },
          },
          example: { ...header.example, table: { groups } },
        };
      }
      const packages = layout.variant === "packages";
      return {
        fields: {
          ...header.fields,
          table: {
            type: "object",
            description: "Cell text shrinks to fit, but keep it short.",
            items: {
              columns: {
                type: "array", minItems: 2, maxItems: MAX_TABLE_COLUMNS,
                description: packages ? "The first column labels the rows; the others are packages." : "The first column labels the rows; the others are phases.",
                items: { title: { type: "string" }, ...(packages ? { subtitle: { type: "string", description: "e.g. the price." } } : {}) },
              },
              rows: {
                type: "array", minItems: 1, maxItems: getTableRowLimit(layout.variant),
                description: packages
                  ? "Each row is an array with one text per column. \"✓\" and \"—\" render as a check and a dash."
                  : "Each row is an array with one text per column: the service, then \"Lead\", \"Support\" or \"—\" per phase.",
              },
              ...(packages ? {
                highlightColumn: { type: "integer", description: "Index (1 or more) of the recommended package, or leave out." },
                badge: { type: "string", description: "Badge on the highlighted column, e.g. \"Recommended\"." },
              } : {}),
            },
          },
        },
        example: {
          ...header.example,
          table: {
            columns: table.columns.map((column) => packages ? { title: column.title, subtitle: column.subtitle } : { title: column.title }),
            rows: table.rows.map((row) => table.columns.map((column) => row.cells[column.id].value)),
            ...(packages ? { highlightColumn: 2, badge: table.badge } : {}),
          },
        },
      };
    }
  }
}

export function getDeckSpecCatalog() {
  const layouts: CatalogLayout[] = SLIDE_LAYOUTS.flatMap((template) => {
    const fixed = STATIC_LAYOUT_CONTENT.find((layout) => layout.layoutId === template.id);
    const component = COMPONENT_LAYOUTS.find((layout) => layout.layoutId === template.id);
    if (!fixed && !component) return [];
    const base = { id: template.id, name: template.name, category: template.category };
    if (fixed) return [{ ...base, purpose: fixed.purpose, ...describeStaticFields(fixed.fields, template.slide, template.id) }];
    return [{ ...base, purpose: component!.purpose, ...describeComponent(component!, template.slide) }];
  });

  return {
    version: DECK_SPEC_VERSION,
    description: "Build a Weekend (WKND) branded deck by choosing a layout for each slide and filling its content fields. Layouts own all positions, colors and fonts.",
    rules: [
      "Send a DeckSpec: { version: 1, title, theme?, footer?: { left?, note? }, slides: [{ layout, theme?, content }] }.",
      "Use only layout ids and content fields listed here. Unknown fields are ignored.",
      "Text must fit: maxChars and maxLines are estimates, and text that does not fit is reported as an error to shorten.",
      "Lists have fixed item counts (minItems–maxItems). Optional fields that are left out are removed from the slide.",
      "Use \"\\n\" in titles to break lines on purpose.",
      "A good deck opens with a cover, may use an agenda and a spotlight divider before each section, and closes with wknd-thank-you or wknd-questions.",
      "Write in the language of the brief. Component layouts (agenda, team, timeline) write an English intro when intro is left out, so set intro for decks in other languages.",
      "Leave out theme to keep each layout's own colors, which is the usual WKND look.",
    ],
    themes: DECK_THEMES.map((theme) => ({ id: theme.id, name: theme.name })),
    layouts,
  };
}
