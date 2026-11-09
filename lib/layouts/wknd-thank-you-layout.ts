import { createFrameElements } from "@/lib/backgrounds/background-themes";
import type { SlideLayoutDefinition } from "@/lib/layouts/layout-definition";
import {
  createRotatedLayoutObject,
  WKND_COLORS,
} from "@/lib/layouts/layout-elements";
import { gridWidth, gridX } from "@/lib/layouts/layout-grid";
import { createLayoutText } from "@/lib/layouts/layout-text";
import type { SlideElement } from "@/types/presentation";

const ID = "wknd-thank-you";
const HEADLINE_SIZE = 310;
const HEADLINE_LINE = 270;
const HEADLINE_TOP = 200;
const CONTACT_LABEL_Y = 834;
const CONTACT_VALUE_Y = 868;
const CONTENT_RIGHT = 1920 - 60;
const CONTACT_GAP = 58;

// Columns are laid out right to left from the margin, each sized to fit
// its default value at 26px with a little slack.
const CONTACTS = [
  { key: "website", label: "Website", value: "weekendinc.com", width: 224 },
  { key: "email", label: "Email", value: "hello@weekendinc.com", width: 308 },
  { key: "phone", label: "Phone", value: "+62 812 0000 0000", width: 280 },
] as const;

function createContacts(): SlideElement[] {
  let right = CONTENT_RIGHT;
  const columns = [...CONTACTS].reverse().map((contact) => {
    const x = right - contact.width;
    right = x - CONTACT_GAP;
    return { ...contact, x };
  });
  return columns.reverse().flatMap((contact) => [
    createLayoutText({
      id: `${ID}-${contact.key}-label`,
      text: contact.label,
      x: contact.x,
      y: CONTACT_LABEL_Y,
      width: contact.width,
      height: 24,
      fontSize: 18,
      color: WKND_COLORS.white,
      opacity: 0.6,
    }),
    createLayoutText({
      id: `${ID}-${contact.key}-value`,
      text: contact.value,
      x: contact.x,
      y: CONTACT_VALUE_Y,
      width: contact.width,
      height: 36,
      fontSize: 26,
      color: WKND_COLORS.white,
    }),
  ]);
}

function createHeadline(id: string, text: string, y: number, color: string) {
  return {
    ...createLayoutText({
      id: `${ID}-${id}`,
      text,
      x: gridX(1) - 14,
      y,
      width: gridWidth(14),
      height: HEADLINE_LINE,
      fontSize: HEADLINE_SIZE,
      fontWeight: 600,
      lineHeight: HEADLINE_LINE / HEADLINE_SIZE,
      color,
    }),
    letterSpacing: -HEADLINE_SIZE * 0.045,
  };
}

export const WKND_THANK_YOU_LAYOUT: SlideLayoutDefinition = {
  id: ID,
  name: "Thank You",
  category: "thankyou",
  slide: {
    id: `layout-${ID}`,
    background: WKND_COLORS.blue,
    darkMode: true,
    elements: [
      // Large cursor arrow pointing back at the headline, bleeding off the top.
      createRotatedLayoutObject({
        id: `${ID}-object`,
        file: "3d-arrow.png",
        size: 950,
        center: { x: 1490, y: 322 },
        rotation: -10,
      }),
      ...createFrameElements(ID, "light"),
      createHeadline("title", "Thank", HEADLINE_TOP, WKND_COLORS.cream),
      createHeadline(
        "title-accent",
        "you.",
        HEADLINE_TOP + HEADLINE_LINE,
        WKND_COLORS.yellow,
      ),
      createLayoutText({
        id: `${ID}-subtitle`,
        text: "Let's build something great together.",
        x: gridX(1),
        y: 852,
        width: gridWidth(11),
        height: 44,
        fontSize: 34,
        color: WKND_COLORS.white,
      }),
      ...createContacts(),
    ],
  },
};
