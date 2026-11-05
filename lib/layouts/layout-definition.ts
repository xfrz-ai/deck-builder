import { duplicateSlideWithNewIds } from "@/lib/slides/slide-utils";
import type { Slide } from "@/types/presentation";

export interface SlideLayoutDefinition {
  category:
    | "agenda"
    | "bento"
    | "cover"
    | "image"
    | "mockup"
    | "table"
    | "team"
    | "text"
    | "timeline";
  id: string;
  name: string;
  slide: Slide;
}

export function instantiateSlideLayout(layout: SlideLayoutDefinition) {
  return duplicateSlideWithNewIds(layout.slide);
}
