export const PRESENTATION_WIDTH = 1920;
export const PRESENTATION_HEIGHT = 1080;
export const PRESENTATION_ASPECT_RATIO = "16:9" as const;

export type SlideElementType = "shape" | "text" | "image";

export type CardPart =
  "background" | "image" | "icon" | "title" | "description";

// Marks an element as one part of an inserted card, so the card's parts can
// be toggled like component properties. `groupId` links the cards that were
// inserted together as one row.
export type ComponentPart = {
  kind: "card";
  instanceId: string;
  groupId: string;
  part: CardPart;
};

export type BaseElement<
  ElementType extends SlideElementType = SlideElementType,
> = {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked?: boolean;
  visible?: boolean;
  role?: "background";
  component?: ComponentPart;
};

export type ShapeElement = BaseElement<"shape"> & {
  shapeType: "rectangle" | "roundedRectangle" | "circle";
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius?: number;
  dashed?: boolean;
};

export type TextElement = BaseElement<"text"> & {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  color: string;
  align: "left" | "center" | "right" | "justify";
  verticalAlign: "top" | "middle" | "bottom";
  lineHeight: number;
  letterSpacing: number;
  textDecoration?: "none" | "underline";
  padding?: number;
};

// Marks an image as a rendered device mockup so it can be edited again.
export type ImageMockup = {
  deviceId: string;
};

export type ImageElement = BaseElement<"image"> & {
  src: string;
  originalWidth?: number;
  originalHeight?: number;
  cornerRadius: number;
  fit?: "cover" | "contain";
  mockup?: ImageMockup;
};

export type SlideElement = ShapeElement | TextElement | ImageElement;

export interface Slide {
  id: string;
  background: string;
  backgroundThemeId?: string;
  darkMode?: boolean;
  elements: SlideElement[];
}

export interface Presentation {
  schemaVersion: 1;
  id: string;
  title: string;
  aspectRatio: typeof PRESENTATION_ASPECT_RATIO;
  width: typeof PRESENTATION_WIDTH;
  height: typeof PRESENTATION_HEIGHT;
  slides: Slide[];
}
