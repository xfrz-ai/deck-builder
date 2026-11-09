import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createLayoutPill,
  createLayoutShape,
  createRotatedLayoutObject,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridWidth, gridX, gridY } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import { estimateComponentText } from "@/lib/text/component-text";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-sow-modules";
// Cards span 8 + 9 + 7 columns; the last column stacks two cards.
const CARD_TOP = 300;
const CARD_BOTTOM = 944;
const CARD_GAP = 24;
const STACK_SPLIT = 688;
// Text on the fixed cream cards sits one step off #111111 so toggling dark
// mode, which swaps #111111 and #FFFFFF, leaves it readable.
const CARD_INK = "#121212";

type NumberStyle = "hero" | "large" | "inline";

interface ModuleCard {
  key: string;
  title: string;
  items: readonly string[];
  x: number;
  y: number;
  width: number;
  height: number;
  number: NumberStyle;
  pill: { height: number; fontSize: number; gap: number };
}

const CARDS: readonly ModuleCard[] = [
  {
    key: "apps",
    title: "Apps",
    items: ["Login", "Homepage", "Synchronize", "Absensi", "Stok Produk", "Outlet", "NOO", "Kompetitor", "Promo", "Report KKS", "Kunjungan Toko"],
    x: gridX(1),
    y: CARD_TOP,
    width: gridWidth(8),
    height: CARD_BOTTOM - CARD_TOP,
    number: "hero",
    pill: { height: 62, fontSize: 27, gap: 14 },
  },
  {
    key: "sfa",
    title: "SFA Hermes",
    items: ["Salesman", "Delivery Method", "Payment Method", "Store Code", "List Kunjungan", "Alokasi Stok", "Setup Maximum Order", "NOO Approval", "Setup Insentif", "Mapping Store Insentif", "Setup Promo", "Setup Promo SKU", "Kompetitor"],
    x: gridX(9),
    y: CARD_TOP,
    width: gridWidth(9),
    height: CARD_BOTTOM - CARD_TOP,
    number: "hero",
    pill: { height: 52, fontSize: 22, gap: 12 },
  },
  {
    key: "report",
    title: "Report",
    items: ["List Penjualan", "EC", "ROA", "Omset", "Insentif", "Visit Log", "NOO", "IPT", "Summary"],
    x: gridX(18),
    y: CARD_TOP,
    width: gridWidth(7),
    height: STACK_SPLIT - CARD_TOP,
    number: "large",
    pill: { height: 44, fontSize: 18, gap: 10 },
  },
  {
    key: "setting",
    title: "Setting",
    items: ["User Roles", "Users", "Target"],
    x: gridX(18),
    y: STACK_SPLIT + CARD_GAP,
    width: gridWidth(7),
    height: CARD_BOTTOM - STACK_SPLIT - CARD_GAP,
    number: "inline",
    pill: { height: 44, fontSize: 18, gap: 10 },
  },
];

const PADDING = 34;
const NUMBER_STYLES = {
  hero: { fontSize: 168, height: 168, labelGap: -6 },
  large: { fontSize: 112, height: 112, labelGap: -4 },
  inline: { fontSize: 52, height: 56, labelGap: 0 },
} as const;

// Template pills are sized from the rough estimate. The side padding
// (about 0.85em each) also absorbs its error, so labels never wrap.
function pillWidth(label: string, fontSize: number) {
  return Math.ceil(estimateComponentText(label, fontSize) * 1.02 + fontSize * 1.7);
}

// Pills flow left to right, wrap at the card width and sit on the card's
// bottom padding, like the reference layout.
function createPills(card: ModuleCard): SlideElement[] {
  const { height, fontSize, gap } = card.pill;
  const maxWidth = card.width - PADDING * 2;
  const rows: { label: string; x: number; width: number }[][] = [[]];
  let x = 0;
  for (const label of card.items) {
    const width = Math.min(maxWidth, pillWidth(label, fontSize));
    if (x > 0 && x + width > maxWidth) {
      rows.push([]);
      x = 0;
    }
    rows[rows.length - 1].push({ label, x, width });
    x += width + gap;
  }
  const bottom = card.y + card.height - PADDING;
  const top = bottom - rows.length * height - (rows.length - 1) * gap;
  return rows.flatMap((row, rowIndex) =>
    row.flatMap((pill, pillIndex) =>
      createLayoutPill({
        id: `${ID}-${card.key}-item-${rowIndex + 1}-${pillIndex + 1}`,
        text: pill.label,
        x: card.x + PADDING + pill.x,
        y: top + rowIndex * (height + gap),
        width: pill.width,
        height,
        fontSize,
        color: CARD_INK,
      }),
    ),
  );
}

function createCard(card: ModuleCard): SlideElement[] {
  const id = `${ID}-${card.key}`;
  const style = NUMBER_STYLES[card.number];
  const right = card.x + card.width - PADDING;
  const numberY = card.y + (card.number === "inline" ? 26 : 30);
  return [
    createLayoutShape({
      id: `${id}-card`,
      shapeType: "roundedRectangle",
      x: card.x,
      y: card.y,
      width: card.width,
      height: card.height,
      cornerRadius: 28,
      fill: WKND_COLORS.cream,
    }),
    {
      ...createLayoutText({
        id: `${id}-title`,
        text: card.title,
        x: card.x + PADDING,
        y: card.y + 34,
        width: card.width - PADDING * 2 - 200,
        height: 52,
        fontSize: 42,
        fontWeight: 600,
        color: CARD_INK,
      }),
      letterSpacing: -42 * 0.03,
    },
    {
      ...createLayoutText({
        id: `${id}-count`,
        text: String(card.items.length).padStart(2, "0"),
        x: right - 320,
        y: numberY,
        width: 320,
        height: style.height,
        fontSize: style.fontSize,
        fontWeight: 700,
        lineHeight: 1,
        align: "right",
        color: WKND_COLORS.blue,
      }),
      letterSpacing: -style.fontSize * 0.06,
    },
    ...(card.number === "inline" ? [] : [
      createLayoutText({
        id: `${id}-count-label`,
        text: "modules",
        x: right - 200,
        y: numberY + style.height + style.labelGap,
        width: 200,
        height: 22,
        fontSize: 17,
        align: "right",
        color: WKND_COLORS.muted,
      }),
    ]),
    ...createPills(card),
  ];
}

export const WKND_SOW_MODULES_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "SOW Modules",
  category: "sow",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      // Stacked W halves in the top-right corner, partly behind the cards.
      createRotatedLayoutObject({
        id: `${ID}-object`,
        file: "3d-w.png",
        size: 640,
        center: { x: 1690, y: 120 },
        rotation: -14,
      }),
      ...createFrameElements(ID, "light"),
      ...createLayoutPill({
        id: `${ID}-eyebrow`,
        text: "SOW",
        x: gridX(1),
        y: gridY(1),
        width: 112,
        height: 48,
        fontSize: 24,
        color: WKND_COLORS.white,
      }),
      {
        ...createLayoutText({
          id: `${ID}-title`,
          text: "Scope of Work",
          x: gridX(1),
          y: gridY(2),
          width: gridWidth(12),
          height: 84,
          fontSize: 80,
          fontWeight: 600,
          lineHeight: 1,
          color: WKND_COLORS.white,
        }),
        letterSpacing: -80 * 0.04,
      },
      ...CARDS.flatMap(createCard),
    ],
  },
};
