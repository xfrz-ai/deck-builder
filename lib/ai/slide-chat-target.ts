import { describeAgendaErrors, mergeAgendaContent, toAgendaContent } from "@/lib/ai/agenda-chat";
import { describeTeamErrors, mergeTeamContent, toTeamContent } from "@/lib/ai/team-chat";
import { describeTimelineErrors, mergeTimelineContent, toTimelineContent } from "@/lib/ai/timeline-chat";
import { getAgendaErrors } from "@/lib/agenda/agenda-elements";
import { AGENDA_VARIANTS, isAgendaData, MAX_AGENDA_ITEMS } from "@/lib/agenda/agenda-model";
import { getTeamErrors } from "@/lib/team/team-elements";
import { getTeamLimits, isTeamData, TEAM_VARIANTS } from "@/lib/team/team-model";
import { getDynamicTimelineErrors } from "@/lib/timeline/timeline-component-elements";
import { getTimelinePhaseLimit, isTimelineData, TIMELINE_VARIANTS } from "@/lib/timeline/timeline-model";
import type { AgendaData } from "@/types/agenda";
import type { Slide } from "@/types/presentation";
import type { TeamData } from "@/types/team";
import type { TimelineData } from "@/types/timeline";

// Same signature as every component's text measure (team, agenda, timeline).
export type TextMeasure = (text: string, size: number, weight?: number, spacing?: number) => number;

// The structured content on a slide that the AI chat can edit.
export type SlideChatTarget =
  | { kind: "team"; slideId: string; label: string; original: TeamData }
  | { kind: "agenda"; slideId: string; label: string; original: AgendaData }
  | { kind: "timeline"; slideId: string; label: string; original: TimelineData };

export type CheckedProposal =
  | { kind: "team"; data: TeamData; errors: string[] }
  | { kind: "agenda"; data: AgendaData; errors: string[] }
  | { kind: "timeline"; data: TimelineData; errors: string[] }
  | { kind: "invalid"; errors: string[] };

function variantName(variants: readonly { id: string; name: string }[], id: string) {
  return variants.find((variant) => variant.id === id)?.name ?? id;
}

// A selected timeline wins, since a timeline can sit on any slide; otherwise
// the slide's own team or agenda, then its first timeline.
export function getSlideChatTarget(slide: Slide | undefined, selectedElementIds: readonly string[]): SlideChatTarget | null {
  if (!slide) return null;
  const selected = new Set(selectedElementIds);
  const selectedTimelineId = slide.elements.find((element) => selected.has(element.id) && element.timelineId)?.timelineId;
  const selectedTimeline = slide.timelines?.find((timeline) => timeline.id === selectedTimelineId);
  if (selectedTimeline) {
    return { kind: "timeline", slideId: slide.id, label: `Timeline · ${variantName(TIMELINE_VARIANTS, selectedTimeline.variant)}`, original: selectedTimeline };
  }
  if (slide.team) {
    return { kind: "team", slideId: slide.id, label: `Team · ${variantName(TEAM_VARIANTS, slide.team.variant)}`, original: slide.team };
  }
  if (slide.agenda) {
    return { kind: "agenda", slideId: slide.id, label: `Agenda · ${variantName(AGENDA_VARIANTS, slide.agenda.variant)}`, original: slide.agenda };
  }
  const timeline = slide.timelines?.[0];
  if (timeline) {
    return { kind: "timeline", slideId: slide.id, label: `Timeline · ${variantName(TIMELINE_VARIANTS, timeline.variant)}`, original: timeline };
  }
  return null;
}

export function getTargetContent(target: SlideChatTarget) {
  switch (target.kind) {
    case "team": return toTeamContent(target.original);
    case "agenda": return toAgendaContent(target.original);
    case "timeline": return toTimelineContent(target.original);
  }
}

// Merges the AI's proposal into the original and runs the same checks as the
// form, so the editor only applies content that fits the design.
export function checkProposal(target: SlideChatTarget, proposal: unknown, measure: TextMeasure): CheckedProposal {
  switch (target.kind) {
    case "team": {
      const data = mergeTeamContent(target.original, proposal);
      if (typeof data === "string") return { kind: "invalid", errors: [data] };
      if (!isTeamData(data)) {
        const limits = getTeamLimits(target.original.variant);
        return { kind: "invalid", errors: [`Use 1–${limits.groups} groups with 1–${limits.members} members each.`] };
      }
      return { kind: "team", data, errors: describeTeamErrors(data, getTeamErrors(data, measure)) };
    }
    case "agenda": {
      const data = mergeAgendaContent(target.original, proposal);
      if (typeof data === "string") return { kind: "invalid", errors: [data] };
      if (!isAgendaData(data)) return { kind: "invalid", errors: [`Use 1–${MAX_AGENDA_ITEMS} agenda items.`] };
      return { kind: "agenda", data, errors: describeAgendaErrors(data, getAgendaErrors(data, measure)) };
    }
    case "timeline": {
      const data = mergeTimelineContent(target.original, proposal);
      if (typeof data === "string") return { kind: "invalid", errors: [data] };
      if (!isTimelineData(data)) {
        return { kind: "invalid", errors: [`Use 1–${getTimelinePhaseLimit(target.original.variant)} phases.`] };
      }
      return { kind: "timeline", data, errors: describeTimelineErrors(data, getDynamicTimelineErrors(data, measure)) };
    }
  }
}

// False when the content changed (e.g. edited by hand) while the AI worked.
export function isTargetCurrent(target: SlideChatTarget, slides: readonly Slide[]) {
  const slide = slides.find((item) => item.id === target.slideId);
  switch (target.kind) {
    case "team": return slide?.team === target.original;
    case "agenda": return slide?.agenda === target.original;
    case "timeline": return slide?.timelines?.find((timeline) => timeline.id === target.original.id) === target.original;
  }
}
