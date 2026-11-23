import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPlaceholderImage,
  createRotatedLayoutObject,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridWidth, gridX } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import { createTwoToneTitle } from "@/lib/layouts/layout-two-tone-title";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-icon-features";
const BODY =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.";

// Photo on the middle eight columns; icon items on columns 1–8 and 17–24.
const PHOTO = { x: gridX(9), y: 372, width: gridWidth(8), height: 588 };
const ICON_SIZE = 112;
const ITEM_ROWS = [430, 680];
const ITEM_TEXT_WIDTH = gridWidth(6);

interface IconItem {
  key: string;
  icon: string;
  title: string;
  titleColor: string;
  column: 1 | 17;
  row: 0 | 1;
}

const ITEMS: readonly IconItem[] = [
  { key: "item-1", icon: "3d-arrow.png", title: "Lorem Ipsum Dolor", titleColor: WKND_COLORS.white, column: 1, row: 0 },
  { key: "item-2", icon: "3d-w.png", title: "Consectetur Adipiscing", titleColor: WKND_COLORS.yellow, column: 17, row: 0 },
  { key: "item-3", icon: "3d-n-white.png", title: "Sed Do Eiusmod", titleColor: WKND_COLORS.white, column: 1, row: 1 },
  { key: "item-4", icon: "3d-k.png", title: "Ut Labore Et Dolore", titleColor: WKND_COLORS.white, column: 17, row: 1 },
];

function createItem(item: IconItem): SlideElement[] {
  const id = `${ID}-${item.key}`;
  const y = ITEM_ROWS[item.row];
  const textX = gridX(item.column + 2);
  return [
    createLayoutObject({
      id: `${id}-icon`,
      file: item.icon,
      size: ICON_SIZE,
      x: gridX(item.column) - 6,
      y: y - 8,
    }),
    {
      ...createLayoutText({
        id: `${id}-title`,
        text: item.title,
        x: textX,
        y,
        width: ITEM_TEXT_WIDTH,
        height: 42,
        fontSize: 34,
        fontWeight: 600,
        color: item.titleColor,
      }),
      letterSpacing: -34 * 0.02,
    },
    createLayoutText({
      id: `${id}-body`,
      text: BODY,
      x: textX,
      y: y + 56,
      width: ITEM_TEXT_WIDTH,
      height: 93,
      fontSize: 22,
      lineHeight: 1.4,
      opacity: 0.8,
      color: WKND_COLORS.white,
    }),
  ];
}

export const WKND_ICON_FEATURES_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Icon Features",
  category: "icon",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      // Orange star bleeding off the top-right corner.
      createRotatedLayoutObject({
        id: `${ID}-object`,
        file: "3d-stars.png",
        size: 520,
        center: { x: 1830, y: 110 },
        rotation: 12,
      }),
      ...createFrameElements(ID, "light"),
      ...createTwoToneTitle({
        id: `${ID}-title`,
        highlight: "Lorem",
        rest: "Ipsum Dolor",
        fontSize: 104,
        align: "center",
        x: 960,
        y: 120,
      }),
      createLayoutText({
        id: `${ID}-intro`,
        text: BODY,
        x: gridX(7),
        y: 252,
        width: gridWidth(12),
        height: 66,
        fontSize: 24,
        lineHeight: 1.35,
        align: "center",
        opacity: 0.85,
        color: WKND_COLORS.white,
      }),
      createLayoutPlaceholderImage({
        id: `${ID}-photo`,
        file: "img 1.png",
        cornerRadius: 28,
        ...PHOTO,
      }),
      ...ITEMS.flatMap(createItem),
    ],
  },
};
