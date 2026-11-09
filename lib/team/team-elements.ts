import { createFrameElements } from "@/lib/backgrounds/background-themes";
import {
  createLayoutObject,
  createLayoutPill,
  createLayoutShape,
  createRotatedLayoutObject,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridHeight, gridWidth, gridX, gridY, LAYOUT_GRID } from "@/lib/layouts/layout-grid";
import { createLayoutText, type LayoutTextOptions } from "@/lib/layouts/layout-text";
import { applyDarkModeToElement } from "@/lib/slides/dark-mode";
import { detachTeamStaticElements, isTeamConnectorElement } from "@/lib/team/team-ownership";
import {
  formatTeamPeopleCount,
  getTeamIntro,
  getTeamLimits,
  getTeamMembers,
  getTeamPeopleCount,
  teamHasLeader,
} from "@/lib/team/team-model";
import {
  componentTextFits,
  estimateComponentText,
  type MeasureComponentText,
} from "@/lib/text/component-text";
import type { ImageElement, Slide, SlideElement, TextElement } from "@/types/presentation";
import type { TeamData, TeamGroup, TeamPerson, TeamVariant } from "@/types/team";

export type MeasureTeamText = MeasureComponentText;
export const estimateTeamText = estimateComponentText;

const CONTENT_WIDTH = gridWidth(24);
const STRUCTURE_CARD_WIDTH = gridWidth(6);
const TEAM_CARD_HEIGHT = gridHeight(6);
const LIST_ROW_HEIGHT = 144;
// Org variants: five columns fill the content width (5×340 + 4×25 = 1800).
const ORG_COLUMN_WIDTH = 340;
const ORG_COLUMN_PITCH = 365;
const TREE_COLUMN_WIDTH = 314;
const TREE_COLUMN_PITCH = 369;
const ORG_CONNECTOR_Y = gridY(5) - 20;
// Text and fills on fixed-colour cards and pills. They sit one step off the
// theme colours because toggling dark mode swaps #111111 and #FFFFFF.
const FIXED_INK = "#121212";
const FIXED_WHITE = "#FFFFFE";
const LEAD_TINT = "#FCE8C3";
const PANEL_FILL = "#F2EEE1";

// Variants designed on a dark background, whose slides start in dark mode.
function isDarkVariant(variant: TeamVariant) {
  return variant === "list" || variant === "org";
}

function fittedText(
  options: LayoutTextOptions & { letterSpacing?: number },
  measure: MeasureTeamText,
  minSize = options.fontSize,
  maxLines = 1,
): TextElement {
  const { letterSpacing = 0, ...textOptions } = options;
  const element = { ...createLayoutText(textOptions), letterSpacing };
  while (element.fontSize > minSize && !componentTextFits(element, measure, maxLines)) {
    element.fontSize--;
  }
  return element;
}

function line(id: string, x: number, y: number, width: number, height: number, fill: string = WKND_COLORS.black) {
  return createLayoutShape({ id, shapeType: "rectangle", x, y, width, height, fill });
}

function portrait(
  data: TeamData,
  member: TeamPerson,
  box: { x: number; y: number; width: number; height: number; cornerRadius: number },
): SlideElement[] {
  const id = `${data.id}-${member.id}-photo`;
  if (member.photo) {
    const image: ImageElement = {
      id,
      type: "image",
      ...box,
      src: member.photo.src,
      originalWidth: member.photo.width,
      originalHeight: member.photo.height,
      fit: "cover",
      rotation: 0,
      opacity: 1,
    };
    return [image];
  }
  const words = member.name.trim().split(/\s+/).filter(Boolean);
  const initials = words.length > 1 ? `${Array.from(words[0])[0]}${Array.from(words[words.length - 1])[0]}` : Array.from(words[0] ?? "?")[0];
  return [
    createLayoutShape({ id, shapeType: "roundedRectangle", ...box, fill: "#E4DFCF" }),
    createLayoutText({
      id: `${id}-initials`, text: initials.toUpperCase(),
      x: box.x, y: box.y, width: box.width, height: box.height,
      fontSize: Math.min(56, Math.round(Math.min(box.width, box.height) * 0.36)),
      fontWeight: 600, align: "center", verticalAlign: "middle",
    }),
  ];
}

function header(data: TeamData, measure: MeasureTeamText): SlideElement[] {
  const isList = data.variant === "list";
  const isOrg = teamHasLeader(data.variant);
  const size = isList ? 96 : isOrg ? 72 : data.variant === "structure" ? 80 : 112;
  const color = isDarkVariant(data.variant) ? WKND_COLORS.white : WKND_COLORS.black;
  const title = isList ? data.title.trim().replace(/\s*\n\s*/g, " ") : data.title.trim();
  const elements: SlideElement[] = [
    ...(data.label.trim() ? createLayoutPill({
      id: `${data.id}-label`, text: data.label.trim(), x: gridX(1), y: gridY(1),
      width: Math.min(gridWidth(8), Math.ceil(measure(data.label.trim(), 24)) + 44),
      height: 48, fontSize: 24, color,
    }) : []),
    fittedText({
      id: `${data.id}-title`, text: title, x: gridX(1), y: gridY(2),
      width: gridWidth(isList ? 14 : isOrg ? 9 : 8), height: Math.ceil(size * 0.92 * (isList ? 1 : 2)),
      fontSize: size, fontWeight: 600, lineHeight: 0.92, letterSpacing: -size * 0.04, color,
    }, measure, 64, isList ? 1 : 2),
  ];
  if ((data.variant === "squads" || data.variant === "people") && getTeamIntro(data)) {
    elements.push(fittedText({
      id: `${data.id}-intro`, text: getTeamIntro(data), x: gridX(1), y: gridY(5) + 24,
      width: gridWidth(7), height: 108, fontSize: 28, lineHeight: 1.28, color: WKND_COLORS.muted,
    }, measure, 24, 3));
  }
  return elements;
}

function structureElements(data: TeamData, measure: MeasureTeamText): SlideElement[] {
  const top = gridY(7);
  const connectorY = gridY(6) + 24;
  const totalWidth = data.groups.length * STRUCTURE_CARD_WIDTH + Math.max(0, data.groups.length - 1) * 24;
  const firstX = gridX(1) + (CONTENT_WIDTH - totalWidth) / 2;
  const centers = data.groups.map((_, index) => firstX + index * (STRUCTURE_CARD_WIDTH + 24) + STRUCTURE_CARD_WIDTH / 2);
  const elements: SlideElement[] = [
    line(`${data.id}-stem`, 959, gridY(5), 2, connectorY - gridY(5)),
    ...(centers.length > 1 ? [line(`${data.id}-connector`, centers[0], connectorY - 1, centers[centers.length - 1] - centers[0], 2)] : []),
    ...centers.map((center, index) => line(`${data.id}-drop-${index}`, center - 1, connectorY, 2, top - connectorY)),
    ...[...new Set([960, ...centers])].map((center, index) => createLayoutShape({
      id: `${data.id}-dot-${index}`, shapeType: "circle", x: center - 7, y: connectorY - 7,
      width: 14, height: 14, fill: WKND_COLORS.black,
    })),
    createLayoutObject({ id: `${data.id}-object`, file: "3d-stars.png", size: 1056, x: (1920 - 1056) / 2, y: -584 }),
  ];
  [["people", 19, getTeamMembers(data).length], ["squads", 22, data.groups.length]].forEach(([label, column, value]) => {
    elements.push(
      fittedText({ id: `${data.id}-stat-${label}`, text: String(value).padStart(2, "0"), x: gridX(Number(column)), y: gridY(1), width: gridWidth(3), height: 104, fontSize: 104, fontWeight: 600, lineHeight: 1, letterSpacing: -4 }, measure),
      createLayoutText({ id: `${data.id}-stat-${label}-label`, text: String(label), x: gridX(Number(column)), y: gridY(3) - 32, width: gridWidth(3), height: 32, fontSize: 26 }),
    );
  });

  data.groups.forEach((group, index) => {
    const id = `${data.id}-${group.id}`;
    const x = firstX + index * (STRUCTURE_CARD_WIDTH + 24);
    const contentX = x + 24;
    const width = STRUCTURE_CARD_WIDTH - 48;
    const name = fittedText({ id: `${id}-name`, text: group.name.trim(), x: contentX, y: top + 24, width: width - 128, height: 44, fontSize: 36, fontWeight: 600, letterSpacing: -1 }, measure, 28);
    const nameWidth = Math.min(name.width, measure(name.text, name.fontSize, name.fontWeight, name.letterSpacing));
    elements.push(
      createLayoutShape({ id: `${id}-card`, shapeType: "roundedRectangle", x, y: top, width: STRUCTURE_CARD_WIDTH, height: TEAM_CARD_HEIGHT, cornerRadius: 24, fill: WKND_COLORS.white }),
      name,
      ...createLayoutPill({ id: `${id}-count`, text: formatTeamPeopleCount(group.members.length), x: contentX + nameWidth + 16, y: top + 28, width: 112, height: 36, fontSize: 17 }),
      fittedText({ id: `${id}-description`, text: group.description.trim(), x: contentX, y: top + 80, width, height: 24, fontSize: 19, color: WKND_COLORS.muted }, measure, 17),
      line(`${id}-divider`, contentX, top + 120, width, 1, "#E6E6E6"),
    );
    group.members.forEach((member, memberIndex) => {
      const memberId = `${data.id}-${member.id}`;
      const y = top + 144 + memberIndex * 80;
      const textX = contentX + (data.showPhotos ? 80 : 0);
      const textWidth = width - (data.showPhotos ? 80 : 0);
      elements.push(
        ...(data.showPhotos ? portrait(data, member, { x: contentX, y, width: 64, height: 64, cornerRadius: 32 }) : []),
        fittedText({ id: `${memberId}-name`, text: member.name.trim(), x: textX, y: y + (data.showRoles && member.role.trim() ? 4 : 18), width: textWidth, height: 28, fontSize: 23, fontWeight: 600 }, measure, 18),
        ...(data.showRoles && member.role.trim() ? [fittedText({ id: `${memberId}-role`, text: member.role.trim(), x: textX, y: y + 36, width: textWidth, height: 24, fontSize: 19, color: WKND_COLORS.muted }, measure, 15)] : []),
      );
    });
  });
  return elements;
}

function squadElements(data: TeamData, measure: MeasureTeamText): SlideElement[] {
  const fills = [WKND_COLORS.orange, WKND_COLORS.blue, WKND_COLORS.black, WKND_COLORS.yellow];
  const elements: SlideElement[] = [
    createLayoutObject({ id: `${data.id}-object`, file: "3d-w.png", size: 800, x: -96, y: gridY(6) + 24 }),
  ];
  data.groups.forEach((group, index) => {
    const id = `${data.id}-${group.id}`;
    const row = Math.floor(index / 2);
    const pairStart = row * 2;
    const first = data.groups[pairStart];
    const second = data.groups[pairStart + 1];
    const firstSpan = !second ? 16 : first.members.length > second.members.length ? 9 : first.members.length < second.members.length ? 7 : row === 0 ? 9 : 7;
    const span = index % 2 === 0 ? firstSpan : 16 - firstSpan;
    const x = gridX(index % 2 === 0 ? 9 : 9 + firstSpan);
    const y = gridY(row === 0 ? 1 : 7);
    const width = gridWidth(span);
    const contentX = x + 24;
    const contentWidth = width - 48;
    const fill = fills[index];
    const color = fill === WKND_COLORS.yellow ? WKND_COLORS.black : WKND_COLORS.white;
    elements.push(
      createLayoutShape({ id: `${id}-card`, shapeType: "roundedRectangle", x, y, width, height: TEAM_CARD_HEIGHT, cornerRadius: 24, fill }),
      fittedText({ id: `${id}-name`, text: group.name.trim(), x: contentX, y: y + 24, width: contentWidth - 128, height: 48, fontSize: 40, fontWeight: 600, letterSpacing: -1, color }, measure, 28),
      ...createLayoutPill({ id: `${id}-count`, text: formatTeamPeopleCount(group.members.length), x: x + width - 136, y: y + 24, width: 112, height: 36, fontSize: 17, color }),
      fittedText({ id: `${id}-description`, text: group.description.trim(), x: contentX, y: y + 76, width: contentWidth, height: 24, fontSize: 18, color, opacity: 0.8 }, measure, 16),
    );
    const photoWidth = (contentWidth - 16 * Math.max(0, group.members.length - 1)) / Math.max(1, group.members.length);
    group.members.forEach((member, memberIndex) => {
      const memberId = `${data.id}-${member.id}`;
      const memberX = data.showPhotos ? contentX + memberIndex * (photoWidth + 16) : contentX;
      const textY = data.showPhotos ? y + 330 : y + 132 + memberIndex * 80;
      const textWidth = data.showPhotos ? photoWidth : contentWidth;
      elements.push(
        ...(data.showPhotos ? portrait(data, member, { x: memberX, y: y + 124, width: photoWidth, height: 190, cornerRadius: 16 }) : []),
        fittedText({ id: `${memberId}-name`, text: member.name.trim(), x: memberX, y: textY, width: textWidth, height: 28, fontSize: 23, fontWeight: 600, color }, measure, 18),
        ...(data.showRoles && member.role.trim() ? [fittedText({ id: `${memberId}-role`, text: member.role.trim(), x: memberX, y: textY + 32, width: textWidth, height: 24, fontSize: 17, color, opacity: 0.8 }, measure, 14)] : []),
      );
    });
  });
  return elements;
}

function peopleElements(data: TeamData, measure: MeasureTeamText): SlideElement[] {
  const members = getTeamMembers(data);
  const compact = members.length > 8;
  const photoWidth = gridWidth(4);
  const photoHeight = compact ? 168 : gridHeight(4);
  const elements: SlideElement[] = [
    createLayoutObject({ id: `${data.id}-object-d`, file: "3d-d.png", size: 264, x: gridX(1) - 24, y: gridY(8) }),
    createLayoutObject({ id: `${data.id}-object-arrow`, file: "3d-arrow.png", size: 144, x: gridX(5), y: gridY(7) }),
  ];
  members.forEach((member, index) => {
    const id = `${data.id}-${member.id}`;
    const x = gridX(9 + index % 4 * 4);
    const row = Math.floor(index / 4);
    const y = gridY(1) + row * (data.showPhotos ? compact ? 288 : 432 : 144);
    const textY = data.showPhotos ? y + photoHeight + (compact ? 16 : 24) : y + 8;
    elements.push(
      ...(data.showPhotos ? portrait(data, member, { x, y, width: photoWidth, height: photoHeight, cornerRadius: 16 }) : []),
      fittedText({ id: `${id}-name`, text: member.name.trim(), x, y: textY, width: photoWidth, height: 32, fontSize: compact ? 24 : 26, fontWeight: 600 }, measure, 20),
      ...(data.showRoles && member.role.trim() ? [fittedText({ id: `${id}-role`, text: member.role.trim(), x, y: textY + 38, width: photoWidth, height: compact ? 42 : 48, fontSize: compact ? 17 : 20, color: WKND_COLORS.muted }, measure, compact ? 16 : 18, 2)] : []),
    );
  });
  return elements;
}

function listElements(data: TeamData, measure: MeasureTeamText): SlideElement[] {
  const tableTop = gridY(4);
  const memberPitch = 4.5 * (LAYOUT_GRID.columnWidth + LAYOUT_GRID.gutter);
  const elements: SlideElement[] = [
    createLayoutObject({ id: `${data.id}-object`, file: "3d-n-white.png", size: 1008, x: 1384, y: -128 }),
  ];
  data.groups.forEach((group, index) => {
    const id = `${data.id}-${group.id}`;
    const top = tableTop + index * LIST_ROW_HEIGHT;
    elements.push(
      { ...line(`${id}-divider`, gridX(1), top, gridWidth(18), 1, WKND_COLORS.white), opacity: 0.25 },
      createLayoutText({ id: `${id}-label`, text: `${String(index + 1).padStart(2, "0")} — ${formatTeamPeopleCount(group.members.length)}`, x: gridX(1), y: top + 20, width: gridWidth(5), height: 24, fontSize: 18, color: WKND_COLORS.white, opacity: 0.7 }),
      fittedText({ id: `${id}-name`, text: group.name.trim(), x: gridX(1), y: top + 46, width: gridWidth(5), height: 52, fontSize: 44, fontWeight: 600, letterSpacing: -1, color: WKND_COLORS.white }, measure, 30),
      fittedText({ id: `${id}-description`, text: group.description.trim(), x: gridX(1), y: top + 102, width: gridWidth(5), height: 24, fontSize: 19, color: WKND_COLORS.white, opacity: 0.7 }, measure, 16),
    );
    group.members.forEach((member, memberIndex) => {
      const memberId = `${data.id}-${member.id}`;
      const x = gridX(6) + memberIndex * memberPitch;
      const textX = x + (data.showPhotos ? 108 : 0);
      const textWidth = memberPitch - (data.showPhotos ? 108 : 16);
      elements.push(
        ...(data.showPhotos ? portrait(data, member, { x, y: top + 28, width: 88, height: 88, cornerRadius: 16 }) : []),
        fittedText({ id: `${memberId}-name`, text: member.name.trim(), x: textX, y: top + (data.showRoles && member.role.trim() ? 42 : 58), width: textWidth, height: 30, fontSize: 25, fontWeight: 600, color: WKND_COLORS.white }, measure, 20),
        ...(data.showRoles && member.role.trim() ? [fittedText({ id: `${memberId}-role`, text: member.role.trim(), x: textX, y: top + 76, width: textWidth, height: 24, fontSize: 18, color: WKND_COLORS.white, opacity: 0.75 }, measure, 15)] : []),
      );
    });
  });
  elements.push({ ...line(`${data.id}-divider-end`, gridX(1), tableTop + data.groups.length * LIST_ROW_HEIGHT, gridWidth(18), 1, WKND_COLORS.white), opacity: 0.25 });
  return elements;
}

// Width for placing text inline with something after it. Layout templates
// are built with the rough estimate, which can run narrow, so they assume a
// wide average glyph; the editor passes a real canvas measure.
function inlineWidth(measure: MeasureTeamText, text: string, size: number, weight = 400, spacing = 0) {
  if (measure !== estimateComponentText) return Math.ceil(measure(text, size, weight, spacing));
  const length = Array.from(text).length;
  return Math.ceil(length * size * (weight >= 600 ? 0.62 : 0.6) + Math.max(0, length - 1) * spacing);
}

function columnCenters(count: number, pitch: number) {
  return Array.from({ length: count }, (_, index) => 960 + (index - (count - 1) / 2) * pitch);
}

// One leader stem into a rail with a drop to each column, dotted at joins.
function orgConnectors(data: TeamData, centers: number[], stemTop: number, dropBottom: number, color: string): SlideElement[] {
  const y = ORG_CONNECTOR_Y;
  const dots = [...new Set([960, ...centers.map(Math.round)])];
  return [
    line(`${data.id}-stem`, 959, stemTop, 2, y - stemTop, color),
    ...(centers.length > 1 ? [line(`${data.id}-connector`, Math.min(960, centers[0]), y - 1, Math.max(960, centers[centers.length - 1]) - Math.min(960, centers[0]), 2, color)] : []),
    ...centers.map((center, index) => line(`${data.id}-drop-${index}`, center - 1, y, 2, dropBottom - y, color)),
    ...dots.map((center, index) => createLayoutShape({
      id: `${data.id}-dot-${index}`, shapeType: "circle", x: center - 6, y: y - 6, width: 12, height: 12, fill: color,
    })),
  ];
}

// "20 people · 05 teams" with accented counts, below the title.
function orgStats(data: TeamData, measure: MeasureTeamText, accent: string, color: string): SlideElement[] {
  const fontSize = 28;
  const people = getTeamPeopleCount(data);
  const parts = [
    { key: "people", text: String(people).padStart(2, "0"), color: accent },
    { key: "people-label", text: people === 1 ? "person" : "people", color },
    { key: "separator", text: "·", color },
    { key: "teams", text: String(data.groups.length).padStart(2, "0"), color: accent },
    { key: "teams-label", text: data.groups.length === 1 ? "team" : "teams", color },
  ];
  const space = Math.max(8, measure(" ", fontSize));
  let x = gridX(1);
  return parts.map((part) => {
    const width = part.key === "separator" ? Math.ceil(fontSize * 0.3) : inlineWidth(measure, part.text, fontSize);
    const element = createLayoutText({ id: `${data.id}-stat-${part.key}`, text: part.text, x, y: gridY(4) + 4, width: width + 12, height: 34, fontSize, color: part.color });
    x += width + space;
    return element;
  });
}

// A filled, fully rounded label such as the leader's "CEO" badge.
function filledPill(id: string, text: string, measure: MeasureTeamText, box: { centerX?: number; x?: number; y: number; height: number; fontSize: number }, fill: string = WKND_COLORS.orange): SlideElement[] {
  const label = text.trim();
  if (!label) return [];
  const width = Math.min(240, inlineWidth(measure, label, box.fontSize, 600) + box.height);
  const x = box.centerX !== undefined ? Math.round(box.centerX - width / 2) : box.x ?? 0;
  return [
    createLayoutShape({ id: `${id}-fill`, shapeType: "roundedRectangle", x, y: box.y, width, height: box.height, cornerRadius: box.height / 2, fill }),
    fittedText({ id: `${id}-label`, text: label, x, y: box.y, width, height: box.height, fontSize: box.fontSize, fontWeight: 600, align: "center", verticalAlign: "middle", color: FIXED_WHITE }, measure, 12),
  ];
}

function circlePortrait(data: TeamData, member: TeamPerson, x: number, y: number, size: number, ring?: string): SlideElement[] {
  if (!ring) return portrait(data, member, { x, y, width: size, height: size, cornerRadius: size / 2 });
  return [
    createLayoutShape({ id: `${data.id}-${member.id}-ring`, shapeType: "circle", x, y, width: size, height: size, fill: ring }),
    ...portrait(data, member, { x: x + 4, y: y + 4, width: size - 8, height: size - 8, cornerRadius: (size - 8) / 2 }),
  ];
}

function personText(
  data: TeamData,
  member: TeamPerson,
  measure: MeasureTeamText,
  box: { x: number; y: number; width: number; nameSize: number; roleSize: number; gap: number; align?: "left" | "center"; color: string; roleColor: string; minName?: number; minRole?: number },
): SlideElement[] {
  const id = `${data.id}-${member.id}`;
  const role = data.showRoles ? member.role.trim() : "";
  const nameHeight = Math.ceil(box.nameSize * 1.2);
  // Beside a portrait, a name without a role centres on the two-line block.
  const offset = role || box.align === "center" ? 0 : Math.round((box.gap + box.roleSize * 1.2 - nameHeight) / 2 + nameHeight / 4);
  return [
    fittedText({ id: `${id}-name`, text: member.name.trim(), x: box.x, y: box.y + offset, width: box.width, height: nameHeight, fontSize: box.nameSize, fontWeight: 600, align: box.align, color: box.color }, measure, box.minName ?? box.nameSize - 5),
    ...(role ? [fittedText({ id: `${id}-role`, text: role, x: box.x, y: box.y + box.gap, width: box.width, height: Math.ceil(box.roleSize * 1.2), fontSize: box.roleSize, align: box.align, color: box.roleColor }, measure, box.minRole ?? box.roleSize - 4)] : []),
  ];
}

// Blue slide: a leader card above five team cards, each with a lead row.
function orgElements(data: TeamData, measure: MeasureTeamText): SlideElement[] {
  const top = ORG_CONNECTOR_Y + 32;
  const centers = columnCenters(data.groups.length, ORG_COLUMN_PITCH);
  const leader = data.leader;
  const leaderBox = { x: 960 - ORG_COLUMN_WIDTH / 2, y: gridY(1), width: ORG_COLUMN_WIDTH, height: 128 };
  const elements: SlideElement[] = [
    createRotatedLayoutObject({ id: `${data.id}-object`, file: "3d-w.png", size: 600, center: { x: 1712, y: 92 }, rotation: -12 }),
    ...orgConnectors(data, centers, leaderBox.y + leaderBox.height, top, WKND_COLORS.white),
    ...orgStats(data, measure, WKND_COLORS.yellow, WKND_COLORS.white),
  ];

  if (leader) {
    const textX = leaderBox.x + (data.showPhotos ? 124 : 24);
    const textWidth = leaderBox.x + leaderBox.width - 20 - textX;
    const badge = filledPill(`${data.id}-leader-badge`, leader.badge, measure, { x: textX, y: leaderBox.y + 20, height: 28, fontSize: 15 });
    const textY = badge.length ? leaderBox.y + 54 : leaderBox.y + 36;
    elements.push(
      createLayoutShape({ id: `${data.id}-leader-card`, shapeType: "roundedRectangle", ...leaderBox, cornerRadius: 28, fill: WKND_COLORS.cream }),
      ...(data.showPhotos ? circlePortrait(data, leader, leaderBox.x + 20, leaderBox.y + 22, 84) : []),
      ...badge,
      ...personText(data, leader, measure, { x: textX, y: textY, width: textWidth, nameSize: 30, roleSize: 18, gap: 40, color: FIXED_INK, roleColor: WKND_COLORS.muted, minRole: 14 }),
    );
  }

  data.groups.forEach((group, index) => {
    const id = `${data.id}-${group.id}`;
    const x = centers[index] - ORG_COLUMN_WIDTH / 2;
    const contentX = x + 24;
    const width = ORG_COLUMN_WIDTH - 48;
    const name = fittedText({ id: `${id}-name`, text: group.name.trim(), x: contentX, y: top + 26, width: width - 104, height: 40, fontSize: 32, fontWeight: 600, letterSpacing: -1, color: FIXED_INK }, measure, 24);
    const nameWidth = Math.min(name.width, inlineWidth(measure, name.text, name.fontSize, name.fontWeight, name.letterSpacing));
    const [lead, ...members] = group.members;
    const photoOffset = data.showPhotos ? 72 : 12;
    elements.push(
      createLayoutShape({ id: `${id}-card`, shapeType: "roundedRectangle", x, y: top, width: ORG_COLUMN_WIDTH, height: 432, cornerRadius: 28, fill: WKND_COLORS.cream }),
      name,
      ...createLayoutPill({ id: `${id}-count`, text: formatTeamPeopleCount(group.members.length), x: contentX + nameWidth + 12, y: top + 31, width: 92, height: 30, fontSize: 15, color: FIXED_INK }),
      fittedText({ id: `${id}-description`, text: group.description.trim(), x: contentX, y: top + 76, width, height: 22, fontSize: 18, color: WKND_COLORS.muted }, measure, 15),
      createLayoutShape({ id: `${id}-lead-card`, shapeType: "roundedRectangle", x: contentX, y: top + 112, width, height: 84, cornerRadius: 18, fill: LEAD_TINT }),
      ...(data.showPhotos ? circlePortrait(data, lead, contentX + 12, top + 124, 60) : []),
      ...personText(data, lead, measure, { x: contentX + photoOffset + 12, y: top + 128, width: width - photoOffset - 24, nameSize: 23, roleSize: 18, gap: 30, color: FIXED_INK, roleColor: WKND_COLORS.orange }),
      ...(members.length ? [line(`${id}-divider`, contentX, top + 208, width, 1, "#E8E1CC")] : []),
    );
    members.forEach((member, memberIndex) => {
      const y = top + 222 + memberIndex * 68;
      const textX = contentX + (data.showPhotos ? 76 : 12);
      elements.push(
        ...(data.showPhotos ? circlePortrait(data, member, contentX + 12, y, 48) : []),
        ...personText(data, member, measure, { x: textX, y: y + 1, width: contentX + width - textX, nameSize: 20, roleSize: 16, gap: 26, color: FIXED_INK, roleColor: WKND_COLORS.muted }),
      );
    });
  });
  return elements;
}

// Cream slide: a ringed leader portrait above a column per team, led by a
// large ringed portrait with the other members in a panel below.
function treeElements(data: TeamData, measure: MeasureTeamText): SlideElement[] {
  const centers = columnCenters(data.groups.length, TREE_COLUMN_PITCH);
  const pillTop = ORG_CONNECTOR_Y + 24;
  const leader = data.leader;
  const leaderTop = gridY(1) - 16;
  const elements: SlideElement[] = [
    createRotatedLayoutObject({ id: `${data.id}-object`, file: "3d-stars.png", size: 520, center: { x: 1712, y: 128 }, rotation: -22 }),
    ...orgConnectors(data, centers, leader && !data.showRoles ? 330 : 350, pillTop, WKND_COLORS.black),
    ...orgStats(data, measure, WKND_COLORS.orange, WKND_COLORS.black),
  ];

  if (leader) {
    const photo = data.showPhotos;
    const textTop = photo ? leaderTop + 180 : 190;
    elements.push(
      ...(photo ? circlePortrait(data, leader, 960 - 82, leaderTop, 164, WKND_COLORS.orange) : []),
      ...filledPill(`${data.id}-leader-badge`, leader.badge, measure, { centerX: 960, y: photo ? leaderTop + 146 : textTop - 44, height: 30, fontSize: 16 }),
      ...personText(data, leader, measure, { x: 720, y: textTop, width: 480, nameSize: 32, roleSize: 19, gap: 40, align: "center", color: WKND_COLORS.black, roleColor: WKND_COLORS.muted, minRole: 15 }),
    );
  }

  data.groups.forEach((group, index) => {
    const id = `${data.id}-${group.id}`;
    const center = centers[index];
    const x = center - TREE_COLUMN_WIDTH / 2;
    const [lead, ...members] = group.members;
    const count = String(group.members.length).padStart(2, "0");
    const countWidth = inlineWidth(measure, count, 19, 600);
    const nameText = group.name.trim();
    const nameWidth = Math.min(TREE_COLUMN_WIDTH - countWidth - 56, inlineWidth(measure, nameText, 19, 600));
    const pillWidth = nameWidth + countWidth + 40;
    const pillX = Math.round(center - pillWidth / 2);
    const leadTop = pillTop + (data.showPhotos ? 56 : 52);
    const leadTextTop = data.showPhotos ? leadTop + 132 : leadTop;
    const panelTop = leadTextTop + (data.showRoles ? 74 : 46);
    elements.push(
      createLayoutShape({ id: `${id}-pill`, shapeType: "roundedRectangle", x: pillX, y: pillTop, width: pillWidth, height: 38, cornerRadius: 19, fill: FIXED_INK }),
      fittedText({ id: `${id}-name`, text: nameText, x: pillX + 16, y: pillTop, width: nameWidth, height: 38, fontSize: 19, fontWeight: 600, verticalAlign: "middle", color: FIXED_WHITE }, measure, 14),
      createLayoutText({ id: `${id}-count`, text: count, x: pillX + 24 + nameWidth, y: pillTop, width: countWidth, height: 38, fontSize: 19, fontWeight: 600, verticalAlign: "middle", color: WKND_COLORS.yellow }),
      ...(data.showPhotos ? circlePortrait(data, lead, center - 60, leadTop, 120, WKND_COLORS.orange) : []),
      ...personText(data, lead, measure, { x, y: leadTextTop, width: TREE_COLUMN_WIDTH, nameSize: 26, roleSize: 18, gap: 34, align: "center", color: WKND_COLORS.black, roleColor: WKND_COLORS.orange }),
    );
    if (!members.length) return;
    elements.push(createLayoutShape({ id: `${id}-panel`, shapeType: "roundedRectangle", x, y: panelTop, width: TREE_COLUMN_WIDTH, height: 18 + members.length * 62, cornerRadius: 22, fill: PANEL_FILL }));
    members.forEach((member, memberIndex) => {
      const y = panelTop + 16 + memberIndex * 62;
      const textX = x + (data.showPhotos ? 84 : 24);
      elements.push(
        ...(data.showPhotos ? circlePortrait(data, member, x + 20, y, 48) : []),
        ...personText(data, member, measure, { x: textX, y: y + 1, width: x + TREE_COLUMN_WIDTH - 16 - textX, nameSize: 19, roleSize: 15, gap: 26, color: FIXED_INK, roleColor: WKND_COLORS.muted }),
      );
    });
  });
  return elements;
}

function getTeamGraphicParts(
  data: TeamData,
  measure: MeasureTeamText,
  darkMode = isDarkVariant(data.variant),
): { graphics: SlideElement[]; decorations: SlideElement[] } {
  const body = data.variant === "structure" ? structureElements(data, measure)
    : data.variant === "squads" ? squadElements(data, measure)
    : data.variant === "people" ? peopleElements(data, measure)
    : data.variant === "org" ? orgElements(data, measure)
    : data.variant === "tree" ? treeElements(data, measure) : listElements(data, measure);
  return {
    decorations: body.filter((element) => element.id.startsWith(`${data.id}-object`)),
    graphics: body.filter((element) => !element.id.startsWith(`${data.id}-object`)).map((element) => ({
      ...(darkMode !== isDarkVariant(data.variant) ? applyDarkModeToElement(element, darkMode) : element),
      teamId: data.id,
      locked: true,
    })),
  };
}

export function createTeamGraphicElements(
  data: TeamData,
  measure: MeasureTeamText = estimateTeamText,
  darkMode = isDarkVariant(data.variant),
): SlideElement[] {
  return getTeamGraphicParts(data, measure, darkMode).graphics;
}

function getTeamBackground(variant: TeamVariant) {
  return variant === "structure" ? WKND_COLORS.yellow
    : variant === "list" || variant === "org" ? WKND_COLORS.blue : WKND_COLORS.cream;
}

export function createTeamGraphicPreview(
  data: TeamData,
  measure: MeasureTeamText = estimateTeamText,
  background?: string,
  darkMode = isDarkVariant(data.variant),
): Slide {
  const elements = createTeamGraphicElements(data, measure, darkMode);
  const previewBackground = background ?? getTeamBackground(data.variant);
  if (!elements.length) return { id: "team-graphic-preview", background: previewBackground, elements: [] };
  const left = Math.min(...elements.map((element) => element.x));
  const top = Math.min(...elements.map((element) => element.y));
  const width = Math.max(...elements.map((element) => element.x + element.width)) - left;
  const height = Math.max(...elements.map((element) => element.y + element.height)) - top;
  const scale = Math.min(1792 / Math.max(1, width), 952 / Math.max(1, height));
  const x = (1920 - width * scale) / 2;
  const y = (1080 - height * scale) / 2;
  return {
    id: "team-graphic-preview",
    background: previewBackground,
    elements: elements.map((element) => ({
      ...element,
      x: x + (element.x - left) * scale,
      y: y + (element.y - top) * scale,
      width: element.width * scale,
      height: element.height * scale,
      ...(element.type === "text" ? {
        fontSize: element.fontSize * scale,
        letterSpacing: element.letterSpacing * scale,
        padding: (element.padding ?? 0) * scale,
      } : {}),
      ...(element.type === "shape" ? {
        strokeWidth: element.strokeWidth * scale,
        cornerRadius: (element.cornerRadius ?? 0) * scale,
      } : {}),
      ...(element.type === "image" ? { cornerRadius: element.cornerRadius * scale } : {}),
    })),
  };
}

export function createTeamSlide(
  data: TeamData,
  slideId: string,
  measure: MeasureTeamText = estimateTeamText,
  previous?: Slide,
): Slide {
  const existing = previous ? detachTeamStaticElements(previous) : undefined;
  const darkMode = existing?.darkMode ?? isDarkVariant(data.variant);
  const background = getTeamBackground(data.variant);
  const { graphics, decorations } = getTeamGraphicParts(data, measure, darkMode);
  const isConnector = (element: SlideElement) => data.variant === "structure" && isTeamConnectorElement(element);
  const connectors = graphics.filter(isConnector);
  const content = graphics.filter((element) => !isConnector(element));
  let insertedConnectors = false;
  let insertedContent = false;
  const elements: SlideElement[] = existing ? existing.elements.flatMap((element) => {
    if (element.teamId !== data.id) return [element];
    if (isConnector(element)) {
      if (insertedConnectors) return [];
      insertedConnectors = true;
      return connectors;
    }
    if (insertedContent) return [];
    insertedContent = true;
    return content;
  }) : [
    ...decorations,
    ...createFrameElements(data.id, darkMode ? "light" : "dark"),
    ...header(data, measure),
  ].map((element) => ({ ...element, locked: element.role === "background" || element.type === "image" }));
  if (!insertedConnectors) elements.unshift(...connectors);
  if (!insertedContent) elements.push(...content);
  return {
    ...existing,
    id: slideId,
    background: existing?.background ?? background,
    darkMode,
    team: { ...data, graphicsOnly: true },
    elements,
  };
}

export function getTeamErrors(data: TeamData, measure: MeasureTeamText = estimateTeamText): Record<string, string> {
  const errors: Record<string, string> = {};
  const elements = createTeamGraphicElements(data, measure);
  const check = (key: string, id: string, message: string, maxLines = 1) => {
    if (errors[key]) return;
    const element = elements.find((element) => element.id === id);
    if (element?.type === "text" && !componentTextFits(element, measure, maxLines)) errors[key] = message;
  };
  const limits = getTeamLimits(data.variant);
  const word = (count: number) => ["zero", "one", "two", "three", "four", "five"][count] ?? String(count);
  if (data.groups.length < 1 || data.groups.length > limits.groups) errors.groups = `Add between one and ${word(limits.groups)} teams.`;
  const leader = data.leader;
  if (teamHasLeader(data.variant) && leader) {
    if (!leader.name.trim()) errors["leader.name"] = "Add the leader's name.";
    else check("leader.name", `${data.id}-${leader.id}-name`, "Shorten the name to fit this design.");
    check("leader.role", `${data.id}-${leader.id}-role`, "Shorten the role to fit this design.");
    check("leader.badge", `${data.id}-leader-badge-label`, "Shorten the badge to fit this design.");
  }
  data.groups.forEach((group: TeamGroup) => {
    const prefix = `${data.id}-${group.id}`;
    if (!group.name.trim()) errors[`${group.id}.name`] = "Add a team name.";
    else check(`${group.id}.name`, `${prefix}-name`, "Shorten the team name to fit this design.");
    check(`${group.id}.description`, `${prefix}-description`, "Shorten the team description to fit this design.");
    if (group.members.length < 1 || group.members.length > limits.members) errors[`${group.id}.members`] = `Add one to ${word(limits.members)} members, or remove this team.`;
    group.members.forEach((member) => {
      if (!member.name.trim()) errors[`${member.id}.name`] = "Add the member's name.";
      else check(`${member.id}.name`, `${data.id}-${member.id}-name`, "Shorten the name to fit this design.");
      check(`${member.id}.role`, `${data.id}-${member.id}-role`, "Shorten the role to fit this design.", data.variant === "people" ? 2 : 1);
    });
  });
  return errors;
}
