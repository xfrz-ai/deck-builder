import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPhoto,
  createLayoutPill,
  createLayoutShape,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import {
  gridHeight,
  gridWidth,
  gridX,
  gridY,
  LAYOUT_GRID,
} from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import {
  createTeamHeader,
  formatPeopleCount,
  TEAM_SQUADS,
  type TeamSquad,
} from "@/lib/layouts/wknd-team-shared";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-team-squads";
const CARD_HEIGHT = gridHeight(6);
const CARD_PADDING = 24;
const PHOTO_GAP = 16;
const PHOTO_TOP = 124;
const PHOTO_HEIGHT = 190;
const W_SIZE = 800;

// Cards fill columns 9–24 in two rows; the wider card holds the bigger squad
// and the widths swap between rows.
const CARDS = [
  {
    column: 9,
    row: 1,
    span: 9,
    fill: WKND_COLORS.orange,
    squad: TEAM_SQUADS.frontend,
  },
  {
    column: 18,
    row: 1,
    span: 7,
    fill: WKND_COLORS.blue,
    squad: TEAM_SQUADS.design,
  },
  {
    column: 9,
    row: 7,
    span: 7,
    fill: WKND_COLORS.black,
    squad: TEAM_SQUADS.backend,
  },
  {
    column: 16,
    row: 7,
    span: 9,
    fill: WKND_COLORS.yellow,
    squad: TEAM_SQUADS.qa,
  },
] as const;

function createSquadCard({
  column,
  fill,
  row,
  span,
  squad,
}: {
  column: number;
  fill: string;
  row: number;
  span: number;
  squad: TeamSquad;
}): SlideElement[] {
  const id = `${ID}-${squad.key}`;
  const x = gridX(column);
  const y = gridY(row);
  const width = gridWidth(span);
  const contentX = x + CARD_PADDING;
  const contentWidth = width - CARD_PADDING * 2;
  const color =
    fill === WKND_COLORS.yellow ? WKND_COLORS.black : WKND_COLORS.white;
  const memberCount = squad.members.length;
  const photoWidth =
    (contentWidth - PHOTO_GAP * (memberCount - 1)) / memberCount;
  const pillWidth = 112;

  return [
    createLayoutShape({
      id: `${id}-card`,
      shapeType: "roundedRectangle",
      x,
      y,
      width,
      height: CARD_HEIGHT,
      cornerRadius: 24,
      fill,
    }),
    {
      ...createLayoutText({
        id: `${id}-name`,
        text: squad.name,
        x: contentX,
        y: y + CARD_PADDING,
        width: contentWidth - pillWidth - 16,
        height: 48,
        fontSize: 40,
        fontWeight: 600,
        color,
      }),
      letterSpacing: -1,
    },
    ...createLayoutPill({
      id: `${id}-count`,
      text: formatPeopleCount(memberCount),
      x: x + width - CARD_PADDING - pillWidth,
      y: y + CARD_PADDING,
      width: pillWidth,
      height: 36,
      fontSize: 17,
      color,
    }),
    createLayoutText({
      id: `${id}-description`,
      text: squad.description,
      x: contentX,
      y: y + 76,
      width: contentWidth,
      height: 24,
      fontSize: 18,
      color,
      opacity: 0.8,
    }),
    ...squad.members.flatMap((member, index) => {
      const memberX = contentX + index * (photoWidth + PHOTO_GAP);

      return [
        createLayoutPhoto({
          id: `${id}-member-${index + 1}-photo`,
          photo: member.photo,
          x: memberX,
          y: y + PHOTO_TOP,
          width: photoWidth,
          height: PHOTO_HEIGHT,
          cornerRadius: 16,
        }),
        createLayoutText({
          id: `${id}-member-${index + 1}-name`,
          text: "Full Name",
          x: memberX,
          y: y + PHOTO_TOP + PHOTO_HEIGHT + 16,
          width: photoWidth,
          height: 28,
          fontSize: 23,
          fontWeight: 600,
          color,
        }),
        createLayoutText({
          id: `${id}-member-${index + 1}-role`,
          text: member.role,
          x: memberX,
          y: y + PHOTO_TOP + PHOTO_HEIGHT + 48,
          width: photoWidth,
          height: 22,
          fontSize: 17,
          color,
          opacity: 0.8,
        }),
      ];
    }),
  ];
}

export const WKND_TEAM_SQUADS_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Team Squads",
  category: "team",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.cream,
    elements: [
      // Cropped by the bottom-left corner, behind the footer and the cards.
      createLayoutObject({
        id: `${ID}-object`,
        file: "3d-w.png",
        size: W_SIZE,
        x: -96,
        y: gridY(6) + LAYOUT_GRID.gutter,
      }),
      ...createFrameElements(ID),
      ...createTeamHeader({
        id: ID,
        title: "Meet the\nsquads.",
        fontSize: 112,
        lineHeight: 0.92,
      }),
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "Four focused squads that ship\ntogether — from first pixel to\nfinal release.",
        x: gridX(1),
        y: gridY(5) + LAYOUT_GRID.gutter,
        width: gridWidth(7),
        height: 108,
        fontSize: 28,
        lineHeight: 1.28,
        color: WKND_COLORS.muted,
      }),
      ...CARDS.flatMap(createSquadCard),
    ],
  },
};
