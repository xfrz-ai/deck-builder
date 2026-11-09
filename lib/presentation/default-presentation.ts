import { createFrameElements } from "@/lib/backgrounds/background-themes";
import {
  PRESENTATION_ASPECT_RATIO,
  PRESENTATION_HEIGHT,
  PRESENTATION_WIDTH,
  type Presentation,
} from "@/types/presentation";

export function createDefaultPresentation(): Presentation {
  return {
    schemaVersion: 1,
    id: "presentation-1",
    title: "Untitled Presentation",
    aspectRatio: PRESENTATION_ASPECT_RATIO,
    width: PRESENTATION_WIDTH,
    height: PRESENTATION_HEIGHT,
    slides: [
      {
        id: "slide-1",
        background: "#ffffff",
        elements: createFrameElements("slide-1"),
      },
    ],
  };
}
