import type { MockupDevice } from "@/lib/mockup/mockup-devices";
import {
  expandQuad,
  type PixelBuffer,
  type Point,
  warpIntoQuad,
} from "@/lib/mockup/perspective-warp";

// Source pixels per output pixel; a little extra keeps small text crisp.
const SOURCE_OVERSAMPLE = 1.5;
// Grows the warp past the mask edge so no frame grey shows through.
const EDGE_BLEED = 1.5;

export interface RenderedMockup {
  src: string;
  width: number;
  height: number;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The mockup image could not load."));
    image.src = src;
  });
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("The mockup canvas is unavailable.");
  }

  return { canvas, context };
}

function distance([x1, y1]: Point, [x2, y2]: Point) {
  return Math.hypot(x2 - x1, y2 - y1);
}

// Crops to the device's screen ratio from the top (app headers stay visible)
// and downsamples close to the size it will be drawn at.
function prepareScreenshot(
  image: HTMLImageElement,
  device: MockupDevice,
): PixelBuffer {
  const { aspectRatio, corners } = device.screen;
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  const screenHeight = Math.max(
    distance(topLeft, bottomLeft),
    distance(topRight, bottomRight),
  );
  const cropWidth = Math.min(
    image.naturalWidth,
    image.naturalHeight * aspectRatio,
  );
  const cropHeight = cropWidth / aspectRatio;
  const height = Math.round(
    Math.min(cropHeight, screenHeight * SOURCE_OVERSAMPLE),
  );
  const width = Math.max(1, Math.round(height * aspectRatio));
  const { context } = createCanvas(width, height);

  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    (image.naturalWidth - cropWidth) / 2,
    0,
    cropWidth,
    cropHeight,
    0,
    0,
    width,
    height,
  );

  return context.getImageData(0, 0, width, height);
}

function encodeCanvas(canvas: HTMLCanvasElement) {
  const webp = canvas.toDataURL("image/webp", 0.92);

  // Browsers without WEBP encoding silently return PNG instead.
  return webp.startsWith("data:image/webp")
    ? webp
    : canvas.toDataURL("image/png");
}

// Flattens the device frame and a perspective-warped screenshot into one
// transparent image.
export async function renderMockup(
  device: MockupDevice,
  screenshotSrc: string,
): Promise<RenderedMockup> {
  const [frame, mask, screenshot] = await Promise.all([
    loadImage(device.frameSrc),
    loadImage(device.screen.maskSrc),
    loadImage(screenshotSrc),
  ]);
  const { width, height } = device;
  const output = createCanvas(width, height);
  const screen = createCanvas(width, height);
  const screenPixels = screen.context.createImageData(width, height);

  warpIntoQuad(
    prepareScreenshot(screenshot, device),
    screenPixels,
    expandQuad(device.screen.corners, EDGE_BLEED),
  );
  screen.context.putImageData(screenPixels, 0, 0);
  screen.context.globalCompositeOperation = "destination-in";
  screen.context.drawImage(mask, device.screen.maskX, device.screen.maskY);

  output.context.drawImage(frame, 0, 0);
  output.context.drawImage(screen.canvas, 0, 0);

  return { src: encodeCanvas(output.canvas), width, height };
}
