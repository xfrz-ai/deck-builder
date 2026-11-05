import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPhoto,
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
import { createTeamHeader } from "@/lib/layouts/wknd-team-shared";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-team-people";
// Each person takes 4 columns × 4 rows for the photo, with the name and role
// in the two rows below; four people per row fill columns 9–24.
const PHOTO_SPAN = 4;
const PHOTO_WIDTH = gridWidth(PHOTO_SPAN);
const PHOTO_HEIGHT = gridHeight(4);

const PEOPLE = [
  { photo: 0, role: "Managing Director" },
  { photo: 1, role: "Creative Director" },
  { photo: 2, role: "Brand Strategist" },
  { photo: 3, role: "Senior Designer" },
  { photo: 4, role: "3D Artist" },
  { photo: 5, role: "Tech Lead" },
  { photo: 6, role: "Front-end Developer" },
  { photo: 7, role: "Account Manager" },
] as const;

function createPerson(
  { photo, role }: (typeof PEOPLE)[number],
  index: number,
): SlideElement[] {
  const id = `${ID}-person-${index + 1}`;
  const x = gridX(9 + (index % 4) * PHOTO_SPAN);
  const y = gridY(index < 4 ? 1 : 7);
  const textTop = y + PHOTO_HEIGHT + LAYOUT_GRID.gutter;

  return [
    createLayoutPhoto({
      id: `${id}-photo`,
      photo,
      x,
      y,
      width: PHOTO_WIDTH,
      height: PHOTO_HEIGHT,
      cornerRadius: 16,
    }),
    createLayoutText({
      id: `${id}-name`,
      text: "Full Name",
      x,
      y: textTop,
      width: PHOTO_WIDTH,
      height: 32,
      fontSize: 26,
      fontWeight: 600,
    }),
    createLayoutText({
      id: `${id}-role`,
      text: role,
      x,
      y: textTop + 38,
      width: PHOTO_WIDTH,
      height: 24,
      fontSize: 20,
      color: WKND_COLORS.muted,
    }),
  ];
}

export const WKND_TEAM_PEOPLE_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Team People",
  category: "team",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.cream,
    elements: [
      ...createFrameElements(ID),
      ...createTeamHeader({
        id: ID,
        title: "Meet the\npeople",
        fontSize: 112,
        lineHeight: 0.92,
      }),
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "A small, senior team of strategists,\ndesigners and builders — working\nas one.",
        x: gridX(1),
        y: gridY(5) + LAYOUT_GRID.gutter,
        width: gridWidth(7),
        height: 108,
        fontSize: 28,
        lineHeight: 1.28,
        color: WKND_COLORS.muted,
      }),
      // The D's curved edge lines up with column 1; the arrow floats above it.
      createLayoutObject({
        id: `${ID}-object-d`,
        file: "3d-d.png",
        size: 264,
        x: gridX(1) - 24,
        y: gridY(8),
      }),
      createLayoutObject({
        id: `${ID}-object-arrow`,
        file: "3d-arrow.png",
        size: 144,
        x: gridX(5),
        y: gridY(7),
      }),
      ...PEOPLE.flatMap(createPerson),
    ],
  },
};
