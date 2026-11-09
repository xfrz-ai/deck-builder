import { createUniqueId } from "@/lib/id";
import { TEAM_SQUADS } from "@/lib/layouts/wknd-team-shared";
import type {
  TeamData,
  TeamGroup,
  TeamLeader,
  TeamPerson,
  TeamPhoto,
  TeamVariant,
} from "@/types/team";

// Upper bounds across all variants; use getTeamLimits for a specific one.
export const MAX_TEAM_GROUPS = 5;
export const MAX_TEAM_MEMBERS_PER_GROUP = 4;

export const TEAM_VARIANTS: readonly {
  id: TeamVariant;
  layoutId: string;
  name: string;
  description: string;
}[] = [
  { id: "structure", layoutId: "wknd-team-structure", name: "Structure", description: "Connected teams" },
  { id: "squads", layoutId: "wknd-team-squads", name: "Squads", description: "Team cards" },
  { id: "people", layoutId: "wknd-team-people", name: "People", description: "Member grid" },
  { id: "list", layoutId: "wknd-team-list", name: "List", description: "Teams in rows" },
  { id: "org", layoutId: "wknd-team-org", name: "Org Cards", description: "Leader above team cards" },
  { id: "tree", layoutId: "wknd-team-tree", name: "Org Tree", description: "Leader above team leads" },
];

// Org variants put one leader above the teams and show each team's first
// member as its lead, so they hold one more team and one more member.
export function teamHasLeader(variant: TeamVariant) {
  return variant === "org" || variant === "tree";
}

export function getTeamLimits(variant: TeamVariant) {
  return teamHasLeader(variant) ? { groups: 5, members: 4 } : { groups: 4, members: 3 };
}

export function getTeamVariantForLayout(layoutId: string) {
  return TEAM_VARIANTS.find((variant) => variant.layoutId === layoutId)?.id;
}

export function createTeamPerson(id = createUniqueId("element")): TeamPerson {
  return { id, name: "", role: "", photo: null };
}

export function createTeamGroup(id = createUniqueId("component")): TeamGroup {
  return {
    id,
    name: "",
    description: "",
    members: [createTeamPerson(`${id}-member-1`)],
  };
}

function placeholderPhoto(index: number): TeamPhoto {
  return {
    src: `/assets/img-people/Placeholder${index === 0 ? "" : `-${index}`}.png`,
    width: 189,
    height: 235,
  };
}

const ORG_GROUPS = [
  { key: "uiux", name: "UI/UX", description: "Product & interface design", members: [[3, "UI/UX Lead"], [1, "Senior UI Designer"], [0, "UX Designer"], [5, "UX Researcher"]] },
  { key: "frontend", name: "Frontend", description: "Web apps & design system", members: [[4, "Front End Lead"], [6, "Senior Front End Engineer"], [7, "Front End Engineer"], [8, "Front End Engineer"]] },
  { key: "product", name: "Product", description: "Roadmap, delivery & client", members: [[0, "Head of PM"], [3, "Product Manager"], [1, "Project Manager"], [2, "Business Analyst"]] },
  { key: "backend", name: "Backend", description: "APIs, data & infrastructure", members: [[5, "Back End Lead"], [4, "Senior Back End Engineer"], [6, "Back End Engineer"], [7, "DevOps Engineer"]] },
  { key: "mobile", name: "Mobile", description: "iOS & Android apps", members: [[8, "Mobile Lead"], [2, "iOS Engineer"], [3, "Android Engineer"]] },
] as const;

function createOrgGroups(id: string): TeamGroup[] {
  return ORG_GROUPS.map((group) => ({
    id: `${id}-group-${group.key}`,
    name: group.name,
    description: group.description,
    members: group.members.map(([photo, role], index) => ({
      id: `${id}-${group.key}-member-${index + 1}`,
      name: "Full Name",
      role,
      photo: placeholderPhoto(photo),
    })),
  }));
}

export function createTeamLeader(id = createUniqueId("element")): TeamLeader {
  return { id, name: "Full Name", role: "Chief Executive Officer", badge: "CEO", photo: placeholderPhoto(2) };
}

export function createDefaultTeam(
  variant: TeamVariant,
  id = createUniqueId("component"),
): TeamData {
  const order = variant === "squads"
    ? [TEAM_SQUADS.frontend, TEAM_SQUADS.design, TEAM_SQUADS.backend, TEAM_SQUADS.qa]
    : [TEAM_SQUADS.design, TEAM_SQUADS.frontend, TEAM_SQUADS.backend, TEAM_SQUADS.qa];
  const peopleGroups = [
    { name: "Leadership", description: "Direction & creative leadership", roles: ["Managing Director", "Creative Director"] },
    { name: "Design", description: "Strategy & visual design", roles: ["Brand Strategist", "Senior Designer"] },
    { name: "Production", description: "Creative & technical production", roles: ["3D Artist", "Tech Lead"] },
    { name: "Delivery", description: "Development & client delivery", roles: ["Front-end Developer", "Account Manager"] },
  ];
  const groups: TeamGroup[] = teamHasLeader(variant) ? createOrgGroups(id) : variant === "people"
    ? peopleGroups.map((group, index) => ({
        id: `${id}-group-${index + 1}`,
        name: group.name,
        description: group.description,
        members: group.roles.map((role, memberIndex) => ({
          id: `${id}-person-${index * 2 + memberIndex + 1}`,
          name: "Full Name",
          role,
          photo: placeholderPhoto(index * 2 + memberIndex),
        })),
      }))
    : order.map((group) => ({
        id: `${id}-group-${group.key}`,
        name: group.name,
        description: group.description,
        members: group.members.map((member, index) => ({
          id: `${id}-${group.key}-member-${index + 1}`,
          name: "Full Name",
          role: member.role,
          photo: placeholderPhoto(member.photo),
        })),
      }));

  return {
    version: 1,
    id,
    variant,
    graphicsOnly: true,
    label: "Our Team",
    title: teamHasLeader(variant) ? "Meet the people\nbehind Weekend." : variant === "structure"
      ? "How the team\nis built."
      : variant === "people" ? "Meet the\npeople" : variant === "list" ? "Meet the squads." : "Meet the\nsquads.",
    introMode: "auto",
    intro: "",
    showPhotos: true,
    showRoles: true,
    ...(teamHasLeader(variant) ? { leader: createTeamLeader(`${id}-leader`) } : {}),
    groups,
  };
}

export function cloneTeam(data: TeamData, freshIds = false): TeamData {
  return {
    ...data,
    id: freshIds ? createUniqueId("component") : data.id,
    ...(data.leader ? {
      leader: {
        ...data.leader,
        id: freshIds ? createUniqueId("element") : data.leader.id,
        photo: data.leader.photo ? { ...data.leader.photo } : null,
      },
    } : {}),
    groups: data.groups.map((group) => ({
      ...group,
      id: freshIds ? createUniqueId("component") : group.id,
      members: group.members.map((member) => ({
        ...member,
        id: freshIds ? createUniqueId("element") : member.id,
        photo: member.photo ? { ...member.photo } : null,
      })),
    })),
  };
}

export function getTeamMembers(data: TeamData) {
  return data.groups.flatMap((group) => group.members);
}

// Everyone on the slide, including the leader of the org variants.
export function getTeamPeopleCount(data: TeamData) {
  return getTeamMembers(data).length + (data.leader ? 1 : 0);
}

export function formatTeamPeopleCount(count: number) {
  return `${String(count).padStart(2, "0")} ${count === 1 ? "person" : "people"}`;
}

export function getTeamIntro(data: TeamData) {
  if (data.introMode === "custom") return data.intro.trim();
  if (data.variant === "people") {
    return "A small, senior team of strategists,\ndesigners and builders — working\nas one.";
  }
  const count = ["Zero", "One", "Two", "Three", "Four"][data.groups.length] ?? String(data.groups.length);
  return `${count} focused ${data.groups.length === 1 ? "squad that ships" : "squads that ship"}\ntogether — from first pixel to\nfinal release.`;
}

export function isTeamData(value: unknown): value is TeamData {
  if (typeof value !== "object" || value === null) return false;
  const data = value as Record<string, unknown>;
  if (
    data.version !== 1 || typeof data.id !== "string" || !data.id ||
    !TEAM_VARIANTS.some((variant) => variant.id === data.variant) ||
    (data.graphicsOnly !== undefined && data.graphicsOnly !== true) ||
    !["label", "title", "intro"].every((key) => typeof data[key] === "string") ||
    (data.introMode !== "auto" && data.introMode !== "custom") ||
    typeof data.showPhotos !== "boolean" || typeof data.showRoles !== "boolean" ||
    !Array.isArray(data.groups)
  ) return false;
  const variant = data.variant as TeamVariant;
  const limits = getTeamLimits(variant);
  if (data.groups.length < 1 || data.groups.length > limits.groups) return false;

  const groupIds = new Set<string>();
  const memberIds = new Set<string>();
  const isPerson = (value: unknown) => {
    if (typeof value !== "object" || value === null) return false;
    const member = value as Record<string, unknown>;
    if (
      typeof member.id !== "string" || !member.id || memberIds.has(member.id) ||
      typeof member.name !== "string" || typeof member.role !== "string"
    ) return false;
    memberIds.add(member.id);
    if (member.photo === null) return true;
    if (typeof member.photo !== "object" || member.photo === null) return false;
    const photo = member.photo as Record<string, unknown>;
    return typeof photo.src === "string" && photo.src.length > 0 &&
      typeof photo.width === "number" && Number.isFinite(photo.width) && photo.width > 0 &&
      typeof photo.height === "number" && Number.isFinite(photo.height) && photo.height > 0;
  };
  if (teamHasLeader(variant)) {
    if (!isPerson(data.leader) || typeof (data.leader as Record<string, unknown>).badge !== "string") return false;
  } else if (data.leader !== undefined) return false;

  return data.groups.every((value: unknown) => {
    if (typeof value !== "object" || value === null) return false;
    const group = value as Record<string, unknown>;
    if (
      typeof group.id !== "string" || !group.id || groupIds.has(group.id) ||
      typeof group.name !== "string" || typeof group.description !== "string" ||
      !Array.isArray(group.members) || group.members.length < 1 || group.members.length > limits.members
    ) return false;
    groupIds.add(group.id);
    return group.members.every(isPerson);
  });
}
