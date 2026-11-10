import {
  type DeckTheme,
  getDeckTheme,
  get3dObjectRole,
  get3dObjectSrc,
  parse3dObjectSrc,
  type ThemeId,
  WKND_3D_COLORS,
  WKND_3D_SWATCHES,
  type Wknd3dColor,
} from "@/lib/themes/deck-themes";
import type {
  ImageElement,
  ShapeElement,
  Slide,
  SlideElement,
  TextElement,
  ThemeBase,
} from "@/types/presentation";

// A theme is applied by re-deriving every element's colors from the colors it
// had before any theme touched it (`themeBase`). Colors that still read well
// on their backdrop are kept, so each layout keeps its design; only colors
// that would clash are swapped for the theme's own. Deriving from the base
// makes switching themes reversible: Orange → Blue → Orange returns the
// original slide.

const INK = "#111111";
const PAPER = "#FFFFFF";

// Text and line colors that mean "the slide's text color".
const INK_COLORS = new Set(["#111111", "#000000", "#121212", "#FFFFFF"]);
// Secondary text greys used by layouts, generators and themes.
const MUTED_COLORS = new Set([
  "#3D3D3D",
  "#555555",
  "#666666",
  "#888888",
  "#9A968C",
  "#A0A0A0",
  "#B3B3B3",
  "#B3BFEC",
  "#BBBBBB",
]);
// Brand accents.
const ACCENT_COLORS = new Set(["#032ABF", "#E04E2B", "#FBB03A"]);

const MIN_TEXT_CONTRAST = 3;
const MIN_BODY_CONTRAST = 4.5;
const MIN_GRAPHIC_CONTRAST = 3;
const MIN_FILL_CONTRAST = 1.12;
const MIN_LINE_CONTRAST = 1.3;
// Shapes thinner than this are rules and dividers, colored like lines.
const LINE_THICKNESS = 6;

const FRAME_LOGOS: Record<string, { dark: string; light: string }> = {
  "/assets/logo-wknd.png": {
    dark: "/assets/logo-wknd.png",
    light: "/assets/logo-wknd-white.png",
  },
  "/assets/logo-wknd-white.png": {
    dark: "/assets/logo-wknd.png",
    light: "/assets/logo-wknd-white.png",
  },
  "/assets/logo-footer.png": {
    dark: "/assets/logo-footer.png",
    light: "/assets/logo-footer-white.png",
  },
  "/assets/logo-footer-white.png": {
    dark: "/assets/logo-footer.png",
    light: "/assets/logo-footer-white.png",
  },
};

// ---------------------------------------------------------------------------
// Color math
// ---------------------------------------------------------------------------

function normalizeHex(color: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : null;
}

function luminance(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [value >> 16, (value >> 8) & 255, value & 255].map(
    (channel) => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    },
  );

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

function bestInk(backdrop: string) {
  return contrastRatio(INK, backdrop) >= contrastRatio(PAPER, backdrop)
    ? INK
    : PAPER;
}

// ---------------------------------------------------------------------------
// Backdrops
// ---------------------------------------------------------------------------

// What an element sits on: the slide background, a filled shape (a card or
// pill), or something we cannot judge (a photo), which leaves it untouched.
type Backdrop =
  | { kind: "slide"; color: string }
  | { kind: "shape"; color: string }
  | { kind: "unknown" };

function isLine(shape: Pick<ShapeElement, "height" | "width">) {
  return Math.min(shape.width, shape.height) <= LINE_THICKNESS;
}

function isFilledShape(element: SlideElement): element is ShapeElement {
  return (
    element.type === "shape" &&
    element.visible !== false &&
    element.opacity >= 0.5 &&
    !isLine(element) &&
    normalizeHex(element.fill) !== null
  );
}

function containsCenter(container: SlideElement, element: SlideElement) {
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;

  return (
    container.width * container.height > element.width * element.height &&
    cx >= container.x &&
    cx <= container.x + container.width &&
    cy >= container.y &&
    cy <= container.y + container.height
  );
}

function findBackdrop(
  elements: readonly SlideElement[],
  index: number,
  background: string,
): Backdrop {
  const element = elements[index];

  for (let i = index - 1; i >= 0; i--) {
    const below = elements[i];

    if (below.visible === false || !containsCenter(below, element)) continue;
    if (isFilledShape(below)) {
      return { kind: "shape", color: normalizeHex(below.fill)! };
    }
    if (below.type === "image" && !parse3dObjectSrc(below.src)) {
      return { kind: "unknown" };
    }
  }

  return { kind: "slide", color: background };
}

// ---------------------------------------------------------------------------
// Color rules
// ---------------------------------------------------------------------------

function accentOn(color: string, backdrop: string, theme: DeckTheme, min: number) {
  if (contrastRatio(color, backdrop) >= min) return color;
  if (contrastRatio(theme.colors.accent, backdrop) >= min) return theme.colors.accent;
  return bestInk(backdrop);
}

function mapTextColor(value: string, backdrop: Backdrop, theme: DeckTheme) {
  const color = normalizeHex(value);
  if (!color || backdrop.kind === "unknown") return value;

  const onSlide = backdrop.kind === "slide";
  const surface = backdrop.color;

  if (INK_COLORS.has(color)) {
    return onSlide ? theme.colors.text : bestInk(surface);
  }
  if (MUTED_COLORS.has(color)) {
    if (onSlide) return theme.colors.muted;
    return contrastRatio(color, surface) >= MIN_BODY_CONTRAST
      ? color
      : bestInk(surface);
  }
  if (ACCENT_COLORS.has(color)) {
    return accentOn(color, surface, theme, MIN_TEXT_CONTRAST);
  }
  if (contrastRatio(color, surface) >= MIN_TEXT_CONTRAST) return color;
  return onSlide ? theme.colors.text : bestInk(surface);
}

function mapLineColor(value: string, backdrop: Backdrop, theme: DeckTheme) {
  const color = normalizeHex(value);
  if (!color || backdrop.kind === "unknown") return value;

  if (INK_COLORS.has(color) || ACCENT_COLORS.has(color)) {
    return mapTextColor(color, backdrop, theme);
  }
  if (contrastRatio(color, backdrop.color) >= MIN_LINE_CONTRAST) return color;
  return backdrop.kind === "slide"
    ? theme.colors.muted
    : bestInk(backdrop.color);
}

function mapFillColor(value: string, backdrop: Backdrop, theme: DeckTheme) {
  const color = normalizeHex(value);
  if (!color || backdrop.kind === "unknown") return value;

  if (ACCENT_COLORS.has(color)) {
    if (contrastRatio(color, backdrop.color) >= 1.5) return color;
    return contrastRatio(theme.colors.accent, backdrop.color) >= 1.5
      ? theme.colors.accent
      : theme.colors.surface;
  }
  if (contrastRatio(color, backdrop.color) >= MIN_FILL_CONTRAST) return color;
  return theme.colors.surface;
}

// Picks the 3D variant: the original if it still reads on its backdrop and
// under any text laid over it, else the theme's variant for the object's
// role, else whichever variant separates best.
function map3dSrc(
  src: string,
  backdrop: Backdrop,
  theme: DeckTheme,
  overlappingText: readonly string[] = [],
) {
  const parsed = parse3dObjectSrc(src);
  if (!parsed || backdrop.kind === "unknown") return src;

  // Reading on the backdrop is required; separating from overlapping text is
  // preferred, as text boxes are often wider than the words in them.
  const onBackdrop = (color: Wknd3dColor) =>
    contrastRatio(WKND_3D_SWATCHES[color], backdrop.color);
  const underText = (color: Wknd3dColor) =>
    Math.min(
      Number.POSITIVE_INFINITY,
      ...overlappingText.map((text) =>
        contrastRatio(WKND_3D_SWATCHES[color], text),
      ),
    );

  const role = get3dObjectRole(parsed.object);
  const candidates = [
    parsed.color,
    theme.object3d[role],
    theme.object3d[role === "primary" ? "secondary" : "primary"],
    ...WKND_3D_COLORS,
  ];
  const readable = candidates.filter(
    (item) => onBackdrop(item) >= MIN_GRAPHIC_CONTRAST,
  );
  const color = readable.length
    ? (readable.find((item) => underText(item) >= MIN_GRAPHIC_CONTRAST) ??
      [...readable].sort((a, b) => underText(b) - underText(a))[0])
    : [...candidates].sort((a, b) => onBackdrop(b) - onBackdrop(a))[0];

  return color === parsed.color ? src : get3dObjectSrc(parsed.object, color);
}

// Share of the text box covered by the object before the text counts as
// sitting on it.
const TEXT_OVERLAP_SHARE = 0.15;

function overlapShare(object: SlideElement, text: SlideElement) {
  const width =
    Math.min(object.x + object.width, text.x + text.width) -
    Math.max(object.x, text.x);
  const height =
    Math.min(object.y + object.height, text.y + text.height) -
    Math.max(object.y, text.y);

  return width > 0 && height > 0
    ? (width * height) / (text.width * text.height)
    : 0;
}

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

function captureBase(element: SlideElement): ThemeBase {
  if (element.type === "text") return { color: element.color };
  if (element.type === "shape") {
    return { fill: element.fill, stroke: element.stroke };
  }
  return { src: element.src };
}

function withBase(element: SlideElement, base: ThemeBase): SlideElement {
  if (element.type === "text" && base.color !== undefined) {
    return { ...element, color: base.color };
  }
  if (element.type === "shape") {
    return {
      ...element,
      fill: base.fill ?? element.fill,
      stroke: base.stroke ?? element.stroke,
    };
  }
  if (element.type === "image" && base.src !== undefined) {
    return { ...element, src: base.src };
  }
  return element;
}

function sameColors(a: SlideElement, b: SlideElement) {
  if (a.type === "text" && b.type === "text") return a.color === b.color;
  if (a.type === "shape" && b.type === "shape") {
    return a.fill === b.fill && a.stroke === b.stroke;
  }
  if (a.type === "image" && b.type === "image") return a.src === b.src;
  return false;
}

function themeShape(
  shape: ShapeElement,
  backdrop: Backdrop,
  theme: DeckTheme,
): ShapeElement {
  if (isLine(shape)) {
    const fill = mapLineColor(shape.fill, backdrop, theme);
    const stroke =
      shape.stroke === shape.fill
        ? fill
        : mapLineColor(shape.stroke, backdrop, theme);
    return { ...shape, fill, stroke };
  }

  const fill = mapFillColor(shape.fill, backdrop, theme);
  const stroke =
    shape.stroke === shape.fill
      ? fill
      : shape.strokeWidth > 0
        ? mapLineColor(shape.stroke, backdrop, theme)
        : shape.stroke;
  return { ...shape, fill, stroke };
}

function themeImage(
  image: ImageElement,
  backdrop: Backdrop,
  theme: DeckTheme,
): ImageElement {
  const logo = FRAME_LOGOS[image.src];
  if (logo && image.role === "background") {
    return { ...image, src: theme.tone === "dark" ? logo.light : logo.dark };
  }
  return { ...image, src: map3dSrc(image.src, backdrop, theme) };
}

function themeText(
  text: TextElement,
  backdrop: Backdrop,
  theme: DeckTheme,
): TextElement {
  return { ...text, color: mapTextColor(text.color, backdrop, theme) };
}

// Colors every element from its base, bottom to top, so text and objects are
// judged against the already-themed card underneath them.
function themeElements(
  elements: readonly SlideElement[],
  bases: readonly ThemeBase[],
  theme: DeckTheme,
): SlideElement[] {
  const result: SlideElement[] = [];

  elements.forEach((element, index) => {
    const base = bases[index];
    const source = withBase(element, base);
    const backdrop = findBackdrop(
      [...result, source],
      index,
      theme.colors.background,
    );
    const themed =
      source.type === "shape"
        ? themeShape(source, backdrop, theme)
        : source.type === "image"
          ? themeImage(source, backdrop, theme)
          : themeText(source, backdrop, theme);

    result.push({ ...themed, themeBase: base });
  });

  // 3D objects are chosen again now that the text above them is colored,
  // so a title is never set on an object of its own color.
  return result.map((element, index) => {
    if (element.type !== "image" || !parse3dObjectSrc(element.src)) {
      return element;
    }

    const overlappingText = result
      .slice(index + 1)
      .filter(
        (above): above is TextElement =>
          above.type === "text" &&
          above.visible !== false &&
          above.text.trim().length > 0 &&
          overlapShare(element, above) >= TEXT_OVERLAP_SHARE,
      )
      .map((text) => normalizeHex(text.color))
      .filter((color): color is string => color !== null);

    if (overlappingText.length === 0) return element;

    const source = withBase(element, bases[index]) as ImageElement;
    const backdrop = findBackdrop(
      [...result.slice(0, index), source],
      index,
      theme.colors.background,
    );
    return {
      ...element,
      src: map3dSrc(source.src, backdrop, theme, overlappingText),
    };
  });
}

// ---------------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------------

function themeSlideShell(slide: Slide, theme: DeckTheme): Slide {
  const backdrop: Backdrop = { kind: "slide", color: theme.colors.background };

  return {
    ...slide,
    background: theme.colors.background,
    darkMode: theme.tone === "dark",
    themeId: theme.id,
    textBlocks: slide.textBlocks?.map((block) => ({
      ...block,
      title: {
        ...block.title,
        color: mapTextColor(block.title.color, backdrop, theme),
      },
      ...(block.body
        ? {
            body: {
              ...block.body,
              color: mapTextColor(block.body.color, backdrop, theme),
            },
          }
        : {}),
    })),
  };
}

// The base each element is themed from. An element whose colors no longer
// match what the current theme derives was edited by hand, so its current
// colors become its new base.
function resolveBases(slide: Slide): ThemeBase[] {
  const current = slide.themeId ? getDeckTheme(slide.themeId) : null;
  const derived = current
    ? themeElements(
        slide.elements,
        slide.elements.map((element) => element.themeBase ?? captureBase(element)),
        current,
      )
    : null;

  return slide.elements.map((element, index) => {
    if (!element.themeBase || !derived) return captureBase(element);
    return sameColors(derived[index], element)
      ? element.themeBase
      : captureBase(element);
  });
}

export function applyThemeToSlide(slide: Slide, themeId: ThemeId): Slide {
  const theme = getDeckTheme(themeId);
  const bases = resolveBases(slide);

  return {
    ...themeSlideShell(slide, theme),
    elements: themeElements(slide.elements, bases, theme),
  };
}

// Themes elements added to an already themed slide (inserted, pasted or
// regenerated by an agenda, team, timeline or table form) and leaves
// everything else as it is.
export function reconcileSlideTheme(slide: Slide): Slide {
  if (!slide.themeId) return slide;
  if (slide.elements.every((element) => element.themeBase)) return slide;

  const theme = getDeckTheme(slide.themeId);
  const themed = themeElements(
    slide.elements,
    slide.elements.map((element) => element.themeBase ?? captureBase(element)),
    theme,
  );

  return {
    ...slide,
    elements: slide.elements.map((element, index) =>
      element.themeBase ? element : themed[index],
    ),
  };
}

// Drops theme bookkeeping, e.g. for elements pasted onto another slide, so
// they are themed afresh from their visible colors.
export function stripThemeBase<T extends SlideElement>(element: T): T {
  if (!element.themeBase) return element;
  const rest = { ...element };
  delete rest.themeBase;
  return rest;
}
