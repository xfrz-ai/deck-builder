import { duplicateElementWithNewId } from "@/lib/elements/duplicate-element";
import type {
  ImageElement,
  ShapeElement,
  Slide,
  SlideElement,
  TextElement,
} from "@/types/presentation";

const FONT_FAMILY = "Plus Jakarta Sans";
const TEXT_COLOR = "#111111";
const LIGHT_TEXT_COLOR = "#FFFFFF";

interface BackgroundThemeDefinition {
  background: string;
  elements: SlideElement[];
  id: string;
  name: string;
}

type BackgroundTextInput = Pick<
  TextElement,
  "align" | "height" | "id" | "text" | "width" | "x" | "y"
> &
  Partial<Pick<TextElement, "color">>;

function createBackgroundText(input: BackgroundTextInput): TextElement {
  return {
    ...input,
    type: "text",
    rotation: 0,
    opacity: 1,
    locked: true,
    visible: true,
    role: "background",
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: 400,
    italic: false,
    color: input.color ?? TEXT_COLOR,
    verticalAlign: "top",
    lineHeight: 1.2,
    letterSpacing: 0,
    textDecoration: "none",
    padding: 0,
  };
}

type BackgroundImageInput = Pick<
  ImageElement,
  | "height"
  | "id"
  | "originalHeight"
  | "originalWidth"
  | "src"
  | "width"
  | "x"
  | "y"
>;

function createBackgroundImage(input: BackgroundImageInput): ImageElement {
  return {
    ...input,
    type: "image",
    rotation: 0,
    opacity: 1,
    locked: true,
    visible: true,
    role: "background",
    cornerRadius: 0,
    fit: "contain",
  };
}

type BackgroundShapeInput = Pick<
  ShapeElement,
  "fill" | "height" | "id" | "width" | "x" | "y"
>;

function createBackgroundShape(input: BackgroundShapeInput): ShapeElement {
  return {
    ...input,
    type: "shape",
    shapeType: "rectangle",
    rotation: 0,
    opacity: 1,
    locked: true,
    visible: true,
    role: "background",
    stroke: input.fill,
    strokeWidth: 0,
  };
}

// Locked logo header and footer shared by backgrounds and layouts. "light"
// frames are for dark backgrounds: white text and white logos.
export function createFrameElements(
  prefix: string,
  tone: "dark" | "light" = "dark",
): SlideElement[] {
  const isLight = tone === "light";
  const color = isLight ? LIGHT_TEXT_COLOR : TEXT_COLOR;

  return [
    createBackgroundImage({
      id: `${prefix}-header-logo`,
      x: 40,
      y: 46,
      width: 83,
      height: 24,
      src: isLight ? "/assets/logo-wknd-white.png" : "/assets/logo-wknd.png",
      originalWidth: 83,
      originalHeight: 24,
    }),
    createBackgroundText({
      id: `${prefix}-footer-left`,
      text: "Weekend Brand Assets",
      x: 40,
      y: 1019,
      width: 280,
      height: 24,
      align: "left",
      color,
    }),
    createBackgroundText({
      id: `${prefix}-footer-note`,
      text: "This document is intended for internal use only",
      x: 1368,
      y: 1019,
      width: 416,
      height: 24,
      align: "right",
      color,
    }),
    createBackgroundShape({
      id: `${prefix}-footer-divider`,
      x: 1800,
      y: 1017,
      width: 1,
      height: 28,
      fill: color,
    }),
    createBackgroundImage({
      id: `${prefix}-footer-copyright`,
      x: 1816,
      y: 999,
      width: 64,
      height: 64,
      src: isLight
        ? "/assets/logo-footer-white.png"
        : "/assets/logo-footer.png",
      originalWidth: 90,
      originalHeight: 90,
    }),
  ];
}

export const BACKGROUND_THEMES = [
  {
    id: "wknd-yellow-w",
    name: "Yellow W",
    background: "#FFFFFF",
    elements: [
      createBackgroundImage({
        id: "wknd-yellow-w-decoration",
        x: 0,
        y: 0,
        width: 1384,
        height: 1080,
        src: "/assets/3d%20logo%20wknd/3d-w-large%20for%20bg.png",
        originalWidth: 1384,
        originalHeight: 1080,
      }),
      ...createFrameElements("wknd-yellow-w"),
    ],
  },
] as const satisfies readonly BackgroundThemeDefinition[];

export type BackgroundThemeId = (typeof BACKGROUND_THEMES)[number]["id"];

export function getBackgroundTheme(themeId: BackgroundThemeId) {
  const theme = BACKGROUND_THEMES.find((item) => item.id === themeId);

  if (!theme) {
    throw new Error(`Unknown background theme: ${themeId}`);
  }

  return theme;
}

export function createBackgroundThemeElements(themeId: BackgroundThemeId) {
  const theme = getBackgroundTheme(themeId);

  return theme.elements.map((element) => duplicateElementWithNewId(element, 0));
}

export function applyBackgroundThemeToSlide(
  slide: Slide,
  themeId: BackgroundThemeId,
): Slide {
  const theme = getBackgroundTheme(themeId);

  const contentElements = slide.elements.filter(
    (element) => element.role !== "background",
  );

  return {
    ...slide,
    background: theme.background,
    backgroundThemeId: theme.id,
    elements: [...createBackgroundThemeElements(theme.id), ...contentElements],
  };
}

export function createBackgroundPreviewSlide(
  theme: (typeof BACKGROUND_THEMES)[number],
): Slide {
  return {
    id: `background-preview-${theme.id}`,
    background: theme.background,
    backgroundThemeId: theme.id,
    elements: [...theme.elements],
  };
}
