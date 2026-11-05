import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPhoto,
  createLayoutShape,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import {
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

const ID = "wknd-team-list";
// One squad per two-row band, divided by hairlines, across columns 1–18.
const TABLE_TOP = gridY(4);
const TABLE_WIDTH = gridWidth(18);
const ROW_HEIGHT = LAYOUT_GRID.rowHeight * 2 + LAYOUT_GRID.gutter * 2;
const PHOTO_SIZE = 88;
const PHOTO_TOP = 28;
// Members start at column 6, four and a half columns apart so three of them
// (with their roles) fit before the table ends.
const MEMBERS_X = gridX(6);
const MEMBER_PITCH = 4.5 * (LAYOUT_GRID.columnWidth + LAYOUT_GRID.gutter);
const MEMBER_TEXT_OFFSET = PHOTO_SIZE + 20;
const N_SIZE = 1008;

const SQUADS = [
  TEAM_SQUADS.design,
  TEAM_SQUADS.frontend,
  TEAM_SQUADS.backend,
  TEAM_SQUADS.qa,
] as const;

function createDivider(id: string, y: number) {
  return {
    ...createLayoutShape({
      id,
      shapeType: "rectangle",
      x: gridX(1),
      y,
      width: TABLE_WIDTH,
      height: 1,
      fill: WKND_COLORS.white,
    }),
    opacity: 0.25,
  };
}

function createSquadRow(squad: TeamSquad, index: number): SlideElement[] {
  const id = `${ID}-${squad.key}`;
  const top = TABLE_TOP + index * ROW_HEIGHT;
  const labelWidth = gridWidth(5);

  return [
    createDivider(`${id}-divider`, top),
    {
      ...createLayoutText({
        id: `${id}-label`,
        text: `${String(index + 1).padStart(2, "0")} — ${formatPeopleCount(squad.members.length)}`,
        x: gridX(1),
        y: top + 20,
        width: labelWidth,
        height: 24,
        fontSize: 18,
        color: WKND_COLORS.white,
      }),
      opacity: 0.7,
    },
    {
      ...createLayoutText({
        id: `${id}-name`,
        text: squad.name,
        x: gridX(1),
        y: top + 46,
        width: labelWidth,
        height: 52,
        fontSize: 44,
        fontWeight: 600,
        color: WKND_COLORS.white,
      }),
      letterSpacing: -1,
    },
    {
      ...createLayoutText({
        id: `${id}-description`,
        text: squad.description,
        x: gridX(1),
        y: top + 102,
        width: labelWidth,
        height: 24,
        fontSize: 19,
        color: WKND_COLORS.white,
      }),
      opacity: 0.7,
    },
    ...squad.members.flatMap((member, memberIndex) => {
      const memberId = `${id}-member-${memberIndex + 1}`;
      const x = MEMBERS_X + memberIndex * MEMBER_PITCH;
      const photoTop = top + PHOTO_TOP;
      const textWidth = MEMBER_PITCH - MEMBER_TEXT_OFFSET;

      return [
        createLayoutPhoto({
          id: `${memberId}-photo`,
          photo: member.photo,
          x,
          y: photoTop,
          width: PHOTO_SIZE,
          height: PHOTO_SIZE,
          cornerRadius: 16,
        }),
        createLayoutText({
          id: `${memberId}-name`,
          text: "Full Name",
          x: x + MEMBER_TEXT_OFFSET,
          y: photoTop + 14,
          width: textWidth,
          height: 30,
          fontSize: 25,
          fontWeight: 600,
          color: WKND_COLORS.white,
        }),
        {
          ...createLayoutText({
            id: `${memberId}-role`,
            text: member.role,
            x: x + MEMBER_TEXT_OFFSET,
            y: photoTop + 48,
            width: textWidth,
            height: 24,
            fontSize: 18,
            color: WKND_COLORS.white,
          }),
          opacity: 0.75,
        },
      ];
    }),
  ];
}

export const WKND_TEAM_LIST_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Squad List",
  category: "team",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      ...createFrameElements(ID, "light"),
      // Cropped by the top-right corner; its cut-out star shows the
      // background through.
      createLayoutObject({
        id: `${ID}-object`,
        file: "3d-n-white.png",
        size: N_SIZE,
        x: 1384,
        y: -128,
      }),
      ...createTeamHeader({
        id: ID,
        title: "Meet the squads.",
        fontSize: 96,
        lineHeight: 0.92,
        titleLines: 1,
        titleWidth: gridWidth(14),
        color: WKND_COLORS.white,
      }),
      ...SQUADS.flatMap(createSquadRow),
      createDivider(
        `${ID}-divider-end`,
        TABLE_TOP + SQUADS.length * ROW_HEIGHT,
      ),
    ],
  },
};
