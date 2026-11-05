export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2;
export const ZOOM_STEP = 0.1;
export const FIT_HORIZONTAL_PADDING = 96;
export const FIT_VERTICAL_PADDING = 136;

export function clampZoom(scale: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

export function calculateFitScale(
  containerWidth: number,
  containerHeight: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  const availableWidth = Math.max(
    0,
    containerWidth - FIT_HORIZONTAL_PADDING,
  );
  const availableHeight = Math.max(
    0,
    containerHeight - FIT_VERTICAL_PADDING,
  );

  if (availableWidth === 0 || availableHeight === 0) {
    return MIN_ZOOM;
  }

  return clampZoom(
    Math.min(availableWidth / canvasWidth, availableHeight / canvasHeight, 1),
  );
}

export function roundZoom(scale: number) {
  return Math.round(scale * 1000) / 1000;
}
