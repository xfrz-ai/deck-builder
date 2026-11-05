import { createUniqueId } from "@/lib/id";
import { calculateInitialImageBounds } from "@/lib/image/image-size";
import type { ImageElement } from "@/types/presentation";

interface CreateImageElementInput {
  src: string;
  originalWidth: number;
  originalHeight: number;
}

export function createImageElement({
  src,
  originalWidth,
  originalHeight,
}: CreateImageElementInput): ImageElement {
  return {
    id: createUniqueId("element"),
    type: "image",
    ...calculateInitialImageBounds(originalWidth, originalHeight),
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    src,
    originalWidth,
    originalHeight,
    cornerRadius: 0,
    fit: "contain",
  };
}
