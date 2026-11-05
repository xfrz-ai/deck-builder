import {
  PRESENTATION_HEIGHT,
  PRESENTATION_WIDTH,
} from "@/types/presentation";

export const MAX_INITIAL_IMAGE_WIDTH = 900;
export const MAX_INITIAL_IMAGE_HEIGHT = 650;

export interface InitialImageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculateInitialImageBounds(
  originalWidth: number,
  originalHeight: number,
): InitialImageBounds {
  if (
    !Number.isFinite(originalWidth) ||
    !Number.isFinite(originalHeight) ||
    originalWidth <= 0 ||
    originalHeight <= 0
  ) {
    throw new Error("Image dimensions must be positive finite numbers.");
  }

  const scale = Math.min(
    MAX_INITIAL_IMAGE_WIDTH / originalWidth,
    MAX_INITIAL_IMAGE_HEIGHT / originalHeight,
    1,
  );
  const width = originalWidth * scale;
  const height = originalHeight * scale;

  return {
    x: (PRESENTATION_WIDTH - width) / 2,
    y: (PRESENTATION_HEIGHT - height) / 2,
    width,
    height,
  };
}
