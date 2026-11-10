import {
  CARD_BACKGROUND_COLORS,
  layoutCardParts,
} from "@/lib/elements/card-component";
import { createUniqueId } from "@/lib/id";
import { resolve3dFile, WKND_3D_SOURCE_SIZE } from "@/lib/themes/deck-themes";
import { gridWidth, gridX, LAYOUT_GRID } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type {
  CardPart,
  ImageElement,
  ShapeElement,
  SlideElement,
} from "@/types/presentation";

export type CardGridColumns = 2 | 3 | 4;

const CARD_PLACEHOLDER_SRC = "/assets/card-placeholder.png";
const CARD_PLACEHOLDER_WIDTH = 1200;
const CARD_PLACEHOLDER_HEIGHT = 900;
const CARD_ICON_SRC = resolve3dFile("3d-stars.png");
const CARD_ICON_SIZE = 64;
const CARD_ICON_ORIGINAL_SIZE = WKND_3D_SOURCE_SIZE;
const CARD_BACKGROUND_FILL = CARD_BACKGROUND_COLORS[0].fill;
const CARD_BACKGROUND_RADIUS = 16;

const CONTENT_X = gridX(1);
const CONTENT_WIDTH = gridWidth(LAYOUT_GRID.columns);
const CARD_GAP = 32;
const CARD_TOP_Y = 360;
const TITLE_HEIGHT = 36;
const DESCRIPTION_HEIGHT = 60;

// Image aspect ratio (width / height) per grid variant.
const CARD_IMAGE_ASPECT: Record<CardGridColumns, number> = {
  2: 16 / 9,
  3: 3 / 2,
  4: 4 / 3,
};

export const CARD_GRID_OPTIONS: readonly CardGridColumns[] = [2, 3, 4];

function createCardImage(
  x: number,
  y: number,
  width: number,
  height: number,
  src: string,
  originalWidth: number,
  originalHeight: number,
  fit: ImageElement["fit"],
): ImageElement {
  return {
    id: createUniqueId("element"),
    type: "image",
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    src,
    originalWidth,
    originalHeight,
    cornerRadius: 0,
    fit,
  };
}

function createCardBackground(x: number, width: number): ShapeElement {
  return {
    id: createUniqueId("element"),
    type: "shape",
    shapeType: "roundedRectangle",
    x,
    y: CARD_TOP_Y,
    width,
    height: 0,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    fill: CARD_BACKGROUND_FILL,
    stroke: CARD_BACKGROUND_FILL,
    strokeWidth: 0,
    cornerRadius: CARD_BACKGROUND_RADIUS,
  };
}

// One card: background and icon (both hidden until toggled on), image, title
// and description, stacked by `layoutCardParts`. The background comes first
// so it renders behind the rest.
function createCard(
  groupId: string,
  x: number,
  width: number,
  imageHeight: number,
): SlideElement[] {
  const instanceId = createUniqueId("component");
  const asPart = <T extends SlideElement>(element: T, part: CardPart): T => ({
    ...element,
    component: { kind: "card", instanceId, groupId, part },
  });
  const elements = [
    asPart(createCardBackground(x, width), "background"),
    asPart(
      createCardImage(
        x,
        CARD_TOP_Y,
        width,
        imageHeight,
        CARD_PLACEHOLDER_SRC,
        CARD_PLACEHOLDER_WIDTH,
        CARD_PLACEHOLDER_HEIGHT,
        "cover",
      ),
      "image",
    ),
    asPart(
      createCardImage(
        x,
        CARD_TOP_Y,
        CARD_ICON_SIZE,
        CARD_ICON_SIZE,
        CARD_ICON_SRC,
        CARD_ICON_ORIGINAL_SIZE,
        CARD_ICON_ORIGINAL_SIZE,
        "contain",
      ),
      "icon",
    ),
    asPart(
      createLayoutText({
        id: createUniqueId("element"),
        text: "Card title",
        x,
        y: CARD_TOP_Y,
        width,
        height: TITLE_HEIGHT,
        fontSize: 28,
        fontWeight: 600,
        lineHeight: 1.2,
      }),
      "title",
    ),
    asPart(
      createLayoutText({
        id: createUniqueId("element"),
        text: "Add a short description for this card.",
        x,
        y: CARD_TOP_Y,
        width,
        height: DESCRIPTION_HEIGHT,
        fontSize: 20,
        lineHeight: 1.5,
      }),
      "description",
    ),
  ];
  const positions = new Map(
    layoutCardParts(elements, instanceId, {
      background: false,
      image: true,
      icon: false,
      title: true,
      description: true,
    }).map(({ elementId, updates }) => [elementId, updates]),
  );

  return elements.map((element) => ({
    ...element,
    ...positions.get(element.id),
  }));
}

export function createCardGridElements(
  columns: CardGridColumns,
): SlideElement[] {
  const cardWidth = Math.floor(
    (CONTENT_WIDTH - CARD_GAP * (columns - 1)) / columns,
  );
  const imageHeight = Math.round(cardWidth / CARD_IMAGE_ASPECT[columns]);
  const groupId = createUniqueId("component");

  return Array.from({ length: columns }, (_, index) =>
    createCard(
      groupId,
      CONTENT_X + index * (cardWidth + CARD_GAP),
      cardWidth,
      imageHeight,
    ),
  ).flat();
}
