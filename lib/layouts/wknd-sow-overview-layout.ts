import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutObject,
  createLayoutPill,
  createLayoutShape,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridWidth, gridX, gridY } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import { estimateComponentText } from "@/lib/text/component-text";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-sow-overview";
// Text on the fixed cream cards (and on the yellow W) sits one step off
// #111111 so toggling dark mode, which swaps #111111 and #FFFFFF, leaves it
// readable.
const CARD_INK = "#121212";

// Summary panel on columns 1–8; cards in two 8-column stacks on 9–16 and
// 17–24, all between the top of row 1 and the footer.
const CARD_TOP = gridY(1);
const CARD_BOTTOM = 944;
const CARD_GAP = 24;
const MIDDLE_SPLIT = CARD_TOP + (CARD_BOTTOM - CARD_TOP - CARD_GAP) / 2;
const RIGHT_SPLIT = 692;
const PADDING = 30;
const PILL = { height: 44, fontSize: 18, gapX: 10, gapY: 8 } as const;

type Swatch = "cream" | "yellow" | "orange" | "outline";

interface ModuleCard {
  key: string;
  product: string;
  title: string;
  items: readonly string[];
  swatch: Swatch;
  x: number;
  y: number;
  height: number;
  countSize: number;
}

const CARD_WIDTH = gridWidth(8);

// Ordered by bar position: Apps, Manage, Report, Setting.
const CARDS: readonly ModuleCard[] = [
  {
    key: "apps",
    product: "SFA Apps",
    title: "Apps",
    items: ["Login", "Homepage", "Synchronize", "Absensi", "Stok Produk", "Outlet", "NOO", "Kompetitor", "Promo", "Report KKS", "Kunjungan Toko"],
    swatch: "cream",
    x: gridX(9),
    y: CARD_TOP,
    height: MIDDLE_SPLIT - CARD_TOP,
    countSize: 112,
  },
  {
    key: "manage",
    product: "SFA Hermes",
    title: "Manage",
    items: ["Salesman", "Delivery Method", "Payment Method", "Store Code", "List Kunjungan", "Alokasi Stok", "Setup Maximum Order", "NOO Approval", "Setup Insentif", "Mapping Store Insentif", "Setup Promo", "Setup Promo SKU", "Kompetitor"],
    swatch: "yellow",
    x: gridX(17),
    y: CARD_TOP,
    height: RIGHT_SPLIT - CARD_TOP,
    countSize: 112,
  },
  {
    key: "report",
    product: "SFA Hermes",
    title: "Report",
    items: ["List Penjualan", "EC", "ROA", "Omset", "Insentif", "Visit Log", "NOO", "IPT", "Summary"],
    swatch: "orange",
    x: gridX(9),
    y: MIDDLE_SPLIT + CARD_GAP,
    height: CARD_BOTTOM - MIDDLE_SPLIT - CARD_GAP,
    countSize: 112,
  },
  {
    key: "setting",
    product: "SFA Hermes",
    title: "Setting",
    items: ["User Roles", "Users", "Target"],
    swatch: "outline",
    x: gridX(17),
    y: RIGHT_SPLIT + CARD_GAP,
    height: CARD_BOTTOM - RIGHT_SPLIT - CARD_GAP,
    countSize: 72,
  },
];

const TOTAL = CARDS.reduce((sum, card) => sum + card.items.length, 0);
const PRODUCT_COUNT = new Set(CARDS.map((card) => card.product)).size;

function pad(count: number) {
  return String(count).padStart(2, "0");
}

// Filled swatch, or a white outline for the last segment.
function createSwatch({
  height,
  id,
  swatch,
  width,
  x,
  y,
}: {
  height: number;
  id: string;
  swatch: Swatch;
  width: number;
  x: number;
  y: number;
}) {
  const outline = swatch === "outline";
  return createLayoutShape({
    id,
    shapeType: "roundedRectangle",
    x,
    y,
    width,
    height,
    cornerRadius: height / 2,
    fill: outline ? "transparent" : WKND_COLORS[swatch],
    stroke: WKND_COLORS[outline ? "white" : swatch],
    strokeWidth: outline ? 2 : 0,
  });
}

// Pill width from the rough estimate; the side padding absorbs its error.
function pillWidth(label: string) {
  return Math.ceil(
    estimateComponentText(label, PILL.fontSize) * 1.02 + PILL.fontSize * 1.7,
  );
}

// Pills flow left to right, wrap at the card width and sit on the card's
// bottom padding.
function createPills(card: ModuleCard): SlideElement[] {
  const maxWidth = CARD_WIDTH - PADDING * 2;
  const rows: { label: string; x: number; width: number }[][] = [[]];
  let x = 0;
  for (const label of card.items) {
    const width = Math.min(maxWidth, pillWidth(label));
    if (x > 0 && x + width > maxWidth) {
      rows.push([]);
      x = 0;
    }
    rows[rows.length - 1].push({ label, x, width });
    x += width + PILL.gapX;
  }
  const bottom = card.y + card.height - PADDING;
  const top = bottom - rows.length * PILL.height - (rows.length - 1) * PILL.gapY;
  return rows.flatMap((row, rowIndex) =>
    row.flatMap((pill, pillIndex) =>
      createLayoutPill({
        id: `${ID}-${card.key}-item-${rowIndex + 1}-${pillIndex + 1}`,
        text: pill.label,
        x: card.x + PADDING + pill.x,
        y: top + rowIndex * (PILL.height + PILL.gapY),
        width: pill.width,
        height: PILL.height,
        fontSize: PILL.fontSize,
        color: CARD_INK,
      }),
    ),
  );
}

function createCard(card: ModuleCard): SlideElement[] {
  const id = `${ID}-${card.key}`;
  const right = card.x + CARD_WIDTH - PADDING;
  return [
    createLayoutShape({
      id: `${id}-card`,
      shapeType: "roundedRectangle",
      x: card.x,
      y: card.y,
      width: CARD_WIDTH,
      height: card.height,
      cornerRadius: 28,
      fill: WKND_COLORS.cream,
    }),
    createLayoutText({
      id: `${id}-product`,
      text: card.product,
      x: card.x + PADDING,
      y: card.y + 32,
      width: 240,
      height: 20,
      fontSize: 16,
      color: WKND_COLORS.muted,
    }),
    {
      ...createLayoutText({
        id: `${id}-title`,
        text: card.title,
        x: card.x + PADDING,
        y: card.y + 58,
        width: CARD_WIDTH - PADDING * 2 - 220,
        height: 42,
        fontSize: 34,
        fontWeight: 600,
        color: CARD_INK,
      }),
      letterSpacing: -34 * 0.02,
    },
    {
      ...createLayoutText({
        id: `${id}-count`,
        text: pad(card.items.length),
        x: right - 240,
        y: card.y + 26,
        width: 240,
        height: card.countSize,
        fontSize: card.countSize,
        fontWeight: 700,
        lineHeight: 1,
        align: "right",
        color: WKND_COLORS.blue,
      }),
      letterSpacing: -card.countSize * 0.06,
    },
    ...createPills(card),
  ];
}

// Segmented bar: one capsule per card, as wide as its share of the total.
const BAR = { x: gridX(1), y: 618, width: gridWidth(8), height: 24, gap: 4 };

function createBar(): SlideElement[] {
  const usable = BAR.width - BAR.gap * (CARDS.length - 1);
  let x = BAR.x;
  return CARDS.map((card, index) => {
    const last = index === CARDS.length - 1;
    const width = last
      ? BAR.x + BAR.width - x
      : Math.round((usable * card.items.length) / TOTAL);
    const segment = createSwatch({
      id: `${ID}-bar-${card.key}`,
      swatch: card.swatch,
      x,
      y: BAR.y,
      width,
      height: BAR.height,
    });
    x += width + BAR.gap;
    return segment;
  });
}

// Two-column legend under the bar: Apps and Report left, Manage and Setting
// right, as in the reference.
const LEGEND = { top: 658, rowHeight: 26, columns: [gridX(1), gridX(5)] };
const LEGEND_SLOTS: Record<string, { column: number; row: number }> = {
  apps: { column: 0, row: 0 },
  manage: { column: 1, row: 0 },
  report: { column: 0, row: 1 },
  setting: { column: 1, row: 1 },
};

function createLegend(): SlideElement[] {
  return CARDS.flatMap((card) => {
    const slot = LEGEND_SLOTS[card.key];
    const x = LEGEND.columns[slot.column];
    const y = LEGEND.top + slot.row * LEGEND.rowHeight;
    const label = `${card.title} ${pad(card.items.length)}`;
    const labelWidth = Math.ceil(estimateComponentText(label, 20) * 1.05) + 4;
    return [
      createSwatch({
        id: `${ID}-legend-${card.key}-dot`,
        swatch: card.swatch,
        x,
        y: y + 6,
        width: 12,
        height: 12,
      }),
      createLayoutText({
        id: `${ID}-legend-${card.key}-label`,
        text: label,
        x: x + 22,
        y,
        width: labelWidth,
        height: 24,
        fontSize: 20,
        color: WKND_COLORS.white,
      }),
      createLayoutText({
        id: `${ID}-legend-${card.key}-product`,
        text: card.product,
        x: x + 22 + labelWidth + 6,
        y: y + 3,
        width: 120,
        height: 20,
        fontSize: 15,
        opacity: 0.6,
        color: WKND_COLORS.white,
      }),
    ];
  });
}

// Frame with the bottom-left footer in dark ink, since it sits on the W.
function createFrame(): SlideElement[] {
  return createFrameElements(ID, "light").map((element) =>
    element.id === `${ID}-footer-left` && element.type === "text"
      ? { ...element, color: CARD_INK }
      : element,
  );
}

export const WKND_SOW_OVERVIEW_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "SOW Overview",
  category: "sow",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      // Yellow W in the bottom-left corner: only the top half shows, the
      // bottom half sits below the canvas, and the cards overlap its tip.
      createLayoutObject({
        id: `${ID}-object`,
        file: "3d-w.png",
        size: 900,
        x: -60,
        y: 664,
      }),
      ...createFrame(),
      ...createLayoutPill({
        id: `${ID}-eyebrow`,
        text: "SOW",
        x: gridX(1),
        y: gridY(1),
        width: 104,
        height: 48,
        fontSize: 24,
        color: WKND_COLORS.white,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Scope of Work",
          x: gridX(1),
          y: 196,
          width: gridWidth(8),
          height: 58,
          fontSize: 58,
          fontWeight: 600,
          lineHeight: 1,
          color: WKND_COLORS.white,
        }),
        letterSpacing: -58 * 0.04,
      },
      {
        ...createLayoutText({
          id: `${ID}-subtitle`,
          text: "SFA Apps & Hermes",
          x: gridX(1),
          y: 254,
          width: gridWidth(8),
          height: 58,
          fontSize: 58,
          fontWeight: 600,
          lineHeight: 1,
          color: WKND_COLORS.yellow,
        }),
        letterSpacing: -58 * 0.04,
      },
      {
        ...createLayoutText({
          id: `${ID}-total`,
          text: String(TOTAL),
          x: gridX(1) - 8,
          y: 346,
          width: gridWidth(8),
          height: 200,
          fontSize: 230,
          fontWeight: 700,
          lineHeight: 0.92,
          color: WKND_COLORS.white,
        }),
        letterSpacing: -230 * 0.06,
      },
      createLayoutText({
        id: `${ID}-total-label`,
        text: `modules across ${PRODUCT_COUNT} products`,
        x: gridX(1),
        y: 568,
        width: gridWidth(8),
        height: 32,
        fontSize: 26,
        color: WKND_COLORS.white,
      }),
      ...createBar(),
      ...createLegend(),
      ...CARDS.flatMap(createCard),
    ],
  },
};
