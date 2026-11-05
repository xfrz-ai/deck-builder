export interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Returns the centered source region that fills the box without distortion.
export function calculateCoverCrop(
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number,
  boxHeight: number,
): ImageCrop {
  if (
    naturalWidth <= 0 ||
    naturalHeight <= 0 ||
    boxWidth <= 0 ||
    boxHeight <= 0
  ) {
    return { x: 0, y: 0, width: naturalWidth, height: naturalHeight };
  }

  const scale = Math.max(boxWidth / naturalWidth, boxHeight / naturalHeight);
  const width = boxWidth / scale;
  const height = boxHeight / scale;

  return {
    x: (naturalWidth - width) / 2,
    y: (naturalHeight - height) / 2,
    width,
    height,
  };
}
