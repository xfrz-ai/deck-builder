import { describeErrors, isRecord, text } from "@/lib/ai/bridge-client";
import { createUniqueId } from "@/lib/id";
import { getTeamLimits, teamHasLeader } from "@/lib/team/team-model";
import type { TeamData, TeamGroup, TeamPerson } from "@/types/team";

// What the AI sees of a team: text and structure only. Photos stay in the
// browser and are matched back by id, so they are never sent.
export interface TeamContent {
  variant: TeamData["variant"];
  limits: { groups: number; membersPerGroup: number };
  hasLeader: boolean;
  leader: { name: string; role: string; badge: string } | null;
  groups: {
    id: string;
    name: string;
    description: string;
    members: { id: string; name: string; role: string; hasPhoto: boolean }[];
  }[];
}

export function toTeamContent(team: TeamData): TeamContent {
  const limits = getTeamLimits(team.variant);
  const hasLeader = teamHasLeader(team.variant);
  return {
    variant: team.variant,
    limits: { groups: limits.groups, membersPerGroup: limits.members },
    hasLeader,
    leader: hasLeader && team.leader
      ? { name: team.leader.name, role: team.leader.role, badge: team.leader.badge }
      : null,
    groups: team.groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      members: group.members.map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role,
        hasPhoto: member.photo !== null,
      })),
    })),
  };
}

// Builds the next TeamData from the AI's proposal. Existing groups and members
// are matched by id so they keep their photos; anything new gets a fresh id.
// Returns an error message when the proposal has the wrong shape.
export function mergeTeamContent(original: TeamData, proposal: unknown): TeamData | string {
  if (!isRecord(proposal) || !Array.isArray(proposal.groups)) {
    return "The proposal must be an object with a groups array.";
  }

  const originalGroups = new Map(original.groups.map((group) => [group.id, group]));
  const originalMembers = new Map<string, TeamPerson>(
    original.groups.flatMap((group) => group.members.map((member) => [member.id, member] as const)),
  );
  const usedGroupIds = new Set<string>();
  const usedMemberIds = new Set<string>();

  const groups: TeamGroup[] = [];
  for (const rawGroup of proposal.groups) {
    if (!isRecord(rawGroup) || !Array.isArray(rawGroup.members)) {
      return "Every group needs a name, description and members array.";
    }
    const requestedId = text(rawGroup.id);
    const groupId = originalGroups.has(requestedId) && !usedGroupIds.has(requestedId)
      ? requestedId
      : createUniqueId("component");
    usedGroupIds.add(groupId);

    const members: TeamPerson[] = [];
    for (const rawMember of rawGroup.members) {
      if (!isRecord(rawMember)) return "Every member needs a name and role.";
      const requestedMemberId = text(rawMember.id);
      const existingMember = usedMemberIds.has(requestedMemberId)
        ? undefined
        : originalMembers.get(requestedMemberId);
      const memberId = existingMember ? requestedMemberId : createUniqueId("element");
      usedMemberIds.add(memberId);
      members.push({
        id: memberId,
        name: text(rawMember.name),
        role: text(rawMember.role),
        photo: existingMember?.photo ?? null,
      });
    }

    groups.push({
      id: groupId,
      name: text(rawGroup.name),
      description: text(rawGroup.description),
      members,
    });
  }

  const next: TeamData = { ...original, groups };
  if (teamHasLeader(original.variant) && original.leader) {
    const leader = isRecord(proposal.leader) ? proposal.leader : null;
    next.leader = leader
      ? {
        ...original.leader,
        name: text(leader.name) || original.leader.name,
        role: text(leader.role),
        badge: text(leader.badge),
      }
      : original.leader;
  }
  return next;
}

export function describeTeamErrors(team: TeamData, errors: Record<string, string>) {
  const labels = new Map<string, string>();
  if (team.leader) labels.set("leader", `Leader "${team.leader.name}"`);
  for (const group of team.groups) {
    labels.set(group.id, `Group "${group.name}"`);
    for (const member of group.members) {
      labels.set(member.id, `Member "${member.name}" in group "${group.name}"`);
    }
  }
  return describeErrors(labels, errors);
}
