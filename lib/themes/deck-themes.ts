// Slide themes: each theme sets the slide background and the colors and 3D
// object variants that stay readable on it (contrast ≥ 3 for graphics and
// large text, ≥ 4.5 for body text where the palette allows it).

export const THEME_IDS = ["blue", "cream", "black", "yellow", "orange"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

// Color variants the 3D brand objects are rendered in.
export const WKND_3D_COLORS = [
  "black",
  "blue",
  "orange",
  "white",
  "yellow",
] as const;

export type Wknd3dColor = (typeof WKND_3D_COLORS)[number];

export const WKND_3D_OBJECTS = ["w", "k", "n", "d", "arrow", "stars"] as const;

export type Wknd3dObject = (typeof WKND_3D_OBJECTS)[number];

export interface DeckTheme {
  id: ThemeId;
  name: string;
  // "dark" themes use white text and white logos.
  tone: "dark" | "light";
  colors: {
    background: string;
    text: string;
    muted: string;
    accent: string;
    onAccent: string;
    surface: string;
    onSurface: string;
  };
  // Large letter objects use the primary variant; arrow and stars use the
  // secondary one.
  object3d: { primary: Wknd3dColor; secondary: Wknd3dColor };
}

export const DECK_THEMES: readonly DeckTheme[] = [
  {
    id: "blue",
    name: "Blue",
    tone: "dark",
    colors: {
      background: "#032ABF",
      text: "#FFFFFF",
      muted: "#B3BFEC",
      accent: "#FBB03A",
      onAccent: "#111111",
      surface: "#FFFBED",
      onSurface: "#111111",
    },
    object3d: { primary: "white", secondary: "yellow" },
  },
  {
    id: "cream",
    name: "Cream",
    tone: "light",
    colors: {
      background: "#FFFBED",
      text: "#111111",
      muted: "#555555",
      accent: "#032ABF",
      onAccent: "#FFFFFF",
      surface: "#EDE8DA",
      onSurface: "#111111",
    },
    object3d: { primary: "blue", secondary: "orange" },
  },
  {
    id: "black",
    name: "Black",
    tone: "dark",
    colors: {
      background: "#111111",
      text: "#FFFFFF",
      muted: "#A0A0A0",
      accent: "#FBB03A",
      onAccent: "#111111",
      surface: "#222222",
      onSurface: "#FFFFFF",
    },
    object3d: { primary: "yellow", secondary: "orange" },
  },
  {
    id: "yellow",
    name: "Yellow",
    tone: "light",
    colors: {
      background: "#FBB03A",
      text: "#111111",
      muted: "#3D3D3D",
      accent: "#032ABF",
      onAccent: "#FFFFFF",
      surface: "#FFFBED",
      onSurface: "#111111",
    },
    object3d: { primary: "blue", secondary: "black" },
  },
  {
    id: "orange",
    name: "Orange",
    tone: "dark",
    colors: {
      background: "#E04E2B",
      // White on orange is 4.0:1, fine for the large type these slides use.
      text: "#FFFFFF",
      // No softer tone stays readable on orange; hierarchy comes from size.
      muted: "#FFFFFF",
      accent: "#111111",
      onAccent: "#FFFFFF",
      surface: "#FFFBED",
      onSurface: "#111111",
    },
    object3d: { primary: "white", secondary: "black" },
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.includes(value as ThemeId);
}

export function getDeckTheme(themeId: ThemeId): DeckTheme {
  const theme = DECK_THEMES.find((item) => item.id === themeId);

  if (!theme) {
    throw new Error(`Unknown theme: ${themeId}`);
  }

  return theme;
}

// ---------------------------------------------------------------------------
// 3D brand objects
// ---------------------------------------------------------------------------

// Square renders, 1000×1000, one folder per color: blue/w-blue.png.
export const WKND_3D_DIR = "/assets/3d-wknd";
export const WKND_3D_SOURCE_SIZE = 1000;

// Approximate surface color of each variant, used for contrast checks.
export const WKND_3D_SWATCHES: Record<Wknd3dColor, string> = {
  black: "#111111",
  blue: "#032ABF",
  orange: "#E04E2B",
  white: "#FFFBED",
  yellow: "#FBB03A",
};

const SECONDARY_OBJECTS = new Set<Wknd3dObject>(["arrow", "stars"]);

export function get3dObjectRole(object: Wknd3dObject) {
  return SECONDARY_OBJECTS.has(object) ? "secondary" : "primary";
}

export function get3dObjectSrc(object: Wknd3dObject, color: Wknd3dColor) {
  return `${WKND_3D_DIR}/${color}/${object}-${color}.png`;
}

// File names of the retired 3d-logo-wknd set, with the color each was
// rendered in, so layouts and saved decks keep their original look.
const LEGACY_3D_FILES: Record<
  string,
  { color: Wknd3dColor; object: Wknd3dObject }
> = {
  "3d-arrow.png": { object: "arrow", color: "white" },
  "3d-d.png": { object: "d", color: "black" },
  "3d-k.png": { object: "k", color: "orange" },
  "3d-n-blue.png": { object: "n", color: "blue" },
  "3d-n-white.png": { object: "n", color: "white" },
  "3d-stars.png": { object: "stars", color: "orange" },
  "3d-w.png": { object: "w", color: "yellow" },
};
const LEGACY_3D_DIR = "/assets/3d-logo-wknd/";

// Layouts name objects by their legacy file name ("3d-w.png").
export function resolve3dFile(file: string) {
  const legacy = LEGACY_3D_FILES[file];

  if (!legacy) {
    throw new Error(`Unknown 3D object file: ${file}`);
  }

  return get3dObjectSrc(legacy.object, legacy.color);
}

// Rewrites a retired 3d-logo-wknd path to the matching new asset.
export function migrateLegacy3dSrc(src: string) {
  if (!src.startsWith(LEGACY_3D_DIR)) {
    return null;
  }

  const legacy = LEGACY_3D_FILES[src.slice(LEGACY_3D_DIR.length)];
  return legacy ? get3dObjectSrc(legacy.object, legacy.color) : null;
}

const WKND_3D_SRC_PATTERN = new RegExp(
  `^${WKND_3D_DIR}/(${WKND_3D_COLORS.join("|")})/(${WKND_3D_OBJECTS.join("|")})-\\1\\.png$`,
);

export function parse3dObjectSrc(
  src: string,
): { color: Wknd3dColor; object: Wknd3dObject } | null {
  const match = WKND_3D_SRC_PATTERN.exec(src);

  return match
    ? { color: match[1] as Wknd3dColor, object: match[2] as Wknd3dObject }
    : null;
}
