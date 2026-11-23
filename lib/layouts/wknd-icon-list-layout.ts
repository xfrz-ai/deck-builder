import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutShape,
  createRotatedLayoutObject,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridWidth, gridX } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import { createTwoToneTitle } from "@/lib/layouts/layout-two-tone-title";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-icon-list";

// Four rows on columns 1–20, ruled above and below: icon, title, then a
// three-line description from column 8.
const LIST = { x: gridX(1), width: gridWidth(20), top: 324, rowHeight: 140 };
const ICON_SIZE = 96;
// The title sits just right of the icon so long titles stay on one line.
const TITLE_X = LIST.x + ICON_SIZE + 20;
const BODY_X = gridX(8);
const BODY_WIDTH = LIST.x + LIST.width - BODY_X;

interface ListRow {
  icon: string;
  title: string;
  body: string;
}

const ROWS: readonly ListRow[] = [
  {
    icon: "3d-arrow.png",
    title: "Lorem Ipsum Dolor",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.",
  },
  {
    icon: "3d-n-white.png",
    title: "Sed Do Eiusmod",
    body: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.",
  },
  {
    icon: "3d-w.png",
    title: "Consectetur Adipiscing",
    body: "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum.",
  },
  {
    icon: "3d-k.png",
    title: "Ut Labore Et Dolore",
    body: "Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet.",
  },
];

function createRule(index: number): SlideElement {
  return {
    ...createLayoutShape({
      id: `${ID}-rule-${index + 1}`,
      shapeType: "rectangle",
      x: LIST.x,
      y: LIST.top + index * LIST.rowHeight,
      width: LIST.width,
      height: 1,
      fill: WKND_COLORS.white,
    }),
    opacity: 0.3,
  };
}

function createRow(row: ListRow, index: number): SlideElement[] {
  const id = `${ID}-row-${index + 1}`;
  const top = LIST.top + index * LIST.rowHeight;
  return [
    createLayoutObject({
      id: `${id}-icon`,
      file: row.icon,
      size: ICON_SIZE,
      x: LIST.x - 8,
      y: top + (LIST.rowHeight - ICON_SIZE) / 2,
    }),
    {
      ...createLayoutText({
        id: `${id}-title`,
        text: row.title,
        x: TITLE_X,
        y: top,
        width: BODY_X - TITLE_X - 24,
        height: LIST.rowHeight,
        fontSize: 30,
        fontWeight: 600,
        verticalAlign: "middle",
        color: WKND_COLORS.white,
      }),
      letterSpacing: -30 * 0.02,
    },
    createLayoutText({
      id: `${id}-body`,
      text: row.body,
      x: BODY_X,
      y: top + 16,
      width: BODY_WIDTH,
      height: LIST.rowHeight - 32,
      fontSize: 20,
      lineHeight: 1.5,
      verticalAlign: "middle",
      opacity: 0.85,
      color: WKND_COLORS.white,
    }),
  ];
}

export const WKND_ICON_LIST_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Icon List",
  category: "icon",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      // Black D on the right edge, tilted, with its dot off the canvas; the
      // list runs over its curve.
      createRotatedLayoutObject({
        id: `${ID}-object`,
        file: "3d-d.png",
        size: 940,
        center: { x: 1870, y: 560 },
        rotation: -12,
      }),
      ...createFrameElements(ID, "light"),
      ...createTwoToneTitle({
        id: `${ID}-title`,
        highlight: "Lorem",
        rest: "Ipsum Dolor",
        fontSize: 96,
        align: "left",
        x: gridX(1),
        y: 112,
      }),
      createLayoutText({
        id: `${ID}-intro`,
        text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.",
        x: gridX(1),
        y: 222,
        width: gridWidth(12),
        height: 66,
        fontSize: 24,
        lineHeight: 1.35,
        opacity: 0.85,
        color: WKND_COLORS.white,
      }),
      ...ROWS.map((_, index) => createRule(index)),
      createRule(ROWS.length),
      ...ROWS.flatMap(createRow),
    ],
  },
};
