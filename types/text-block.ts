import type { TextElement } from "@/types/presentation";

export type TextBlockTemplate = "title" | "title-body" | "body-title" | "title-beside-body" | "body-beside-title";
export type TextBlockPart = "title" | "body";
export type TextBlockContent = Pick<TextElement,
  "text" | "fontFamily" | "fontSize" | "fontWeight" | "italic" | "color" | "align" |
  "lineHeight" | "letterSpacing" | "opacity" | "textDecoration"
>;

export interface TextBlockData {
  version: 1;
  id: string;
  template: TextBlockTemplate;
  x: number;
  y: number;
  width: number;
  gap: number;
  title: TextBlockContent;
  body?: TextBlockContent;
}

export type TextBlockLayoutUpdates = Partial<Pick<TextBlockData, "x" | "y" | "width" | "gap">> & {
  align?: TextElement["align"];
};
