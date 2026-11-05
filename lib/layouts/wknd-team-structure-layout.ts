import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPhoto,
  createLayoutPill,
  createLayoutShape,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridHeight, gridWidth, gridX, gridY } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import {
  createTeamHeader,
  formatPeopleCount,
  TEAM_SQUADS,
  type TeamSquad,
} from "@/lib/layouts/wknd-team-shared";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-team-structure";
const CARD_SPAN = 6;
const CARD_WIDTH = gridWidth(CARD_SPAN);
const CARD_TOP = gridY(7);
const CARD_HEIGHT = gridHeight(6);
const CARD_PADDING = 24;
const AVATAR_SIZE = 64;
const MEMBER_PITCH = 80;
// The connector runs through the middle of row 6, just above the cards.
const CONNECTOR_Y = gridY(6) + 24;
const LINE_WIDTH = 2;
const DOT_SIZE = 14;
const DIVIDER_COLOR = "#E6E6E6";
const STAR_SIZE = 1056;
// Rendered width of each squad name at 36px, so its count pill sits beside it.
const SQUAD_NAME_WIDTHS: Record<string, number> = {
  backend: 146,
  design: 112,
  frontend: 150,
  qa: 52,
};

const SQUADS = [
  { column: 1, squad: TEAM_SQUADS.design },
  { column: 7, squad: TEAM_SQUADS.frontend },
  { column: 13, squad: TEAM_SQUADS.backend },
  { column: 19, squad: TEAM_SQUADS.qa },
] as const;

const PEOPLE_COUNT = SQUADS.reduce(
  (count, { squad }) => count + squad.members.length,
  0,
);

function cardCenterX(column: number) {
  return gridX(column) + CARD_WIDTH / 2;
}

function createLine(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string = WKND_COLORS.black,
) {
  return createLayoutShape({
    id,
    shapeType: "rectangle",
    x,
    y,
    width,
    height,
    fill,
  });
}

function createDot(id: string, centerX: number) {
  return createLayoutShape({
    id,
    shapeType: "circle",
    x: centerX - DOT_SIZE / 2,
    y: CONNECTOR_Y - DOT_SIZE / 2,
    width: DOT_SIZE,
    height: DOT_SIZE,
    fill: WKND_COLORS.black,
  });
}

// Stem from the star down to the connector, then a drop into each card.
function createConnector(): SlideElement[] {
  const firstX = cardCenterX(SQUADS[0].column);
  const lastX = cardCenterX(SQUADS[SQUADS.length - 1].column);

  return [
    createLine(
      `${ID}-stem`,
      960 - LINE_WIDTH / 2,
      gridY(5),
      LINE_WIDTH,
      CONNECTOR_Y - gridY(5),
    ),
    createLine(
      `${ID}-connector`,
      firstX,
      CONNECTOR_Y - LINE_WIDTH / 2,
      lastX - firstX,
      LINE_WIDTH,
    ),
    ...SQUADS.map(({ column, squad }) =>
      createLine(
        `${ID}-${squad.key}-drop`,
        cardCenterX(column) - LINE_WIDTH / 2,
        CONNECTOR_Y,
        LINE_WIDTH,
        CARD_TOP - CONNECTOR_Y,
      ),
    ),
    createDot(`${ID}-stem-dot`, 960),
    ...SQUADS.map(({ column, squad }) =>
      createDot(`${ID}-${squad.key}-dot`, cardCenterX(column)),
    ),
  ];
}

function createStat(key: string, column: number, value: number, label: string) {
  return [
    {
      ...createLayoutText({
        id: `${ID}-stat-${key}-value`,
        text: String(value).padStart(2, "0"),
        x: gridX(column),
        y: gridY(1),
        width: gridWidth(3),
        height: 104,
        fontSize: 104,
        fontWeight: 600,
        lineHeight: 1,
      }),
      letterSpacing: -4,
    },
    createLayoutText({
      id: `${ID}-stat-${key}-label`,
      text: label,
      x: gridX(column),
      y: gridY(3) - 32,
      width: gridWidth(3),
      height: 32,
      fontSize: 26,
    }),
  ];
}

function createSquadCard(column: number, squad: TeamSquad): SlideElement[] {
  const id = `${ID}-${squad.key}`;
  const x = gridX(column);
  const contentX = x + CARD_PADDING;
  const contentWidth = CARD_WIDTH - CARD_PADDING * 2;
  const membersTop = CARD_TOP + 144;

  return [
    createLayoutShape({
      id: `${id}-card`,
      shapeType: "roundedRectangle",
      x,
      y: CARD_TOP,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      cornerRadius: 24,
      fill: WKND_COLORS.white,
    }),
    {
      ...createLayoutText({
        id: `${id}-name`,
        text: squad.name,
        x: contentX,
        y: CARD_TOP + CARD_PADDING,
        width: SQUAD_NAME_WIDTHS[squad.key] + 8,
        height: 44,
        fontSize: 36,
        fontWeight: 600,
      }),
      letterSpacing: -1,
    },
    ...createLayoutPill({
      id: `${id}-count`,
      text: formatPeopleCount(squad.members.length),
      x: contentX + SQUAD_NAME_WIDTHS[squad.key] + 16,
      y: CARD_TOP + CARD_PADDING + 4,
      width: 112,
      height: 36,
      fontSize: 17,
    }),
    createLayoutText({
      id: `${id}-description`,
      text: squad.description,
      x: contentX,
      y: CARD_TOP + 80,
      width: contentWidth,
      height: 24,
      fontSize: 19,
      color: WKND_COLORS.muted,
    }),
    createLine(
      `${id}-divider`,
      contentX,
      CARD_TOP + 120,
      contentWidth,
      1,
      DIVIDER_COLOR,
    ),
    ...squad.members.flatMap((member, index) => {
      const top = membersTop + index * MEMBER_PITCH;
      const textX = contentX + AVATAR_SIZE + 16;

      return [
        createLayoutPhoto({
          id: `${id}-member-${index + 1}-photo`,
          photo: member.photo,
          x: contentX,
          y: top,
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          cornerRadius: AVATAR_SIZE / 2,
        }),
        createLayoutText({
          id: `${id}-member-${index + 1}-name`,
          text: "Full Name",
          x: textX,
          y: top + 4,
          width: contentWidth - AVATAR_SIZE - 16,
          height: 28,
          fontSize: 23,
          fontWeight: 600,
        }),
        createLayoutText({
          id: `${id}-member-${index + 1}-role`,
          text: member.role,
          x: textX,
          y: top + 36,
          width: contentWidth - AVATAR_SIZE - 16,
          height: 24,
          fontSize: 19,
          color: WKND_COLORS.muted,
        }),
      ];
    }),
  ];
}

export const WKND_TEAM_STRUCTURE_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Team Structure",
  category: "team",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.yellow,
    elements: [
      ...createFrameElements(ID),
      ...createConnector(),
      // Centred over the stem and cropped by the top edge.
      createLayoutObject({
        id: `${ID}-object`,
        file: "3d-stars.png",
        size: STAR_SIZE,
        x: (1920 - STAR_SIZE) / 2,
        y: -584,
      }),
      ...createTeamHeader({
        id: ID,
        title: "How the team\nis built.",
        fontSize: 80,
        lineHeight: 0.92,
      }),
      ...createStat("people", 19, PEOPLE_COUNT, "people"),
      ...createStat("squads", 22, SQUADS.length, "squads"),
      ...SQUADS.flatMap(({ column, squad }) => createSquadCard(column, squad)),
    ],
  },
};
