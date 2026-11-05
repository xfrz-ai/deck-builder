import type PptxGenJS from "pptxgenjs";

import { calculateCoverCrop } from "@/lib/image/image-fit";
import type {
  BaseElement,
  ImageElement,
  Presentation,
  ShapeElement,
  TextElement,
} from "@/types/presentation";

const LOGICAL_PIXELS_PER_INCH = 144;
const LOGICAL_PIXELS_PER_POINT = 2;
const MAX_RASTER_DIMENSION = 4096;
// SVGs are rasterized at this multiple of their slide size.
const SVG_RASTER_SCALE = 4;

interface PowerPointBox {
  h: number;
  w: number;
  x: number;
  y: number;
}

export interface PptxExportResult {
  fileName: string;
  missingImageCount: number;
}

function logicalPixelsToInches(value: number) {
  return value / LOGICAL_PIXELS_PER_INCH;
}

function logicalPixelsToPoints(value: number) {
  return value / LOGICAL_PIXELS_PER_POINT;
}

function toHexColor(color: string, fallback = "000000") {
  const normalized = color.trim().replace(/^#/, "");

  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized.toUpperCase();
  }

  if (/^[0-9a-fA-F]{3}$/.test(normalized)) {
    return normalized
      .split("")
      .map((character) => `${character}${character}`)
      .join("")
      .toUpperCase();
  }

  return fallback;
}

function toTransparency(opacity: number) {
  const clampedOpacity = Math.min(1, Math.max(0, opacity));
  return Math.round((1 - clampedOpacity) * 100);
}

function getPowerPointBox(element: BaseElement): PowerPointBox {
  const rotation = (element.rotation * Math.PI) / 180;
  const halfWidth = element.width / 2;
  const halfHeight = element.height / 2;
  const rotatedCenterX =
    element.x +
    Math.cos(rotation) * halfWidth -
    Math.sin(rotation) * halfHeight;
  const rotatedCenterY =
    element.y +
    Math.sin(rotation) * halfWidth +
    Math.cos(rotation) * halfHeight;

  return {
    x: logicalPixelsToInches(rotatedCenterX - halfWidth),
    y: logicalPixelsToInches(rotatedCenterY - halfHeight),
    w: logicalPixelsToInches(element.width),
    h: logicalPixelsToInches(element.height),
  };
}

function sanitizeFileName(title: string) {
  const normalized = title
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 80);
  const withoutExtension = normalized.replace(/\.pptx$/i, "").trim();

  return `${withoutExtension || "Untitled Presentation"}.pptx`;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("The image could not be encoded."));
      }
    };
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(blob);
  });
}

function loadBrowserImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be decoded."));
    image.src = dataUrl;
  });
}

async function rasterizeImage(
  dataUrl: string,
  targetWidth?: number,
  targetHeight?: number,
  cornerRadius = 0,
  cover = false,
) {
  const image = await loadBrowserImage(dataUrl);
  // Cover keeps the cropped region at its native resolution.
  const crop =
    cover && targetWidth && targetHeight
      ? calculateCoverCrop(
          image.naturalWidth,
          image.naturalHeight,
          targetWidth,
          targetHeight,
        )
      : null;
  const cropScale = crop && targetWidth ? crop.width / targetWidth : 1;
  const sourceWidth = crop?.width ?? targetWidth ?? image.naturalWidth;
  const sourceHeight = crop?.height ?? targetHeight ?? image.naturalHeight;
  const rasterScale = Math.min(
    1,
    MAX_RASTER_DIMENSION / Math.max(sourceWidth, sourceHeight),
  );
  const width = Math.max(1, Math.round(sourceWidth * rasterScale));
  const height = Math.max(1, Math.round(sourceHeight * rasterScale));
  const radius = Math.min(
    Math.max(0, cornerRadius * cropScale * rasterScale),
    width / 2,
    height / 2,
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("The image canvas is unavailable.");
  }

  if (radius > 0) {
    context.beginPath();
    context.roundRect(0, 0, width, height, radius);
    context.clip();
  }

  if (crop) {
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      width,
      height,
    );
  } else {
    context.drawImage(image, 0, 0, width, height);
  }
  return canvas.toDataURL("image/png");
}

function getDataUrlMimeType(dataUrl: string) {
  return /^data:([^;,]+)[;,]/i.exec(dataUrl)?.[1]?.toLowerCase() ?? "";
}

function createImageDataResolver() {
  const sourceCache = new Map<string, Promise<string>>();
  const renderCache = new Map<string, Promise<string>>();

  const resolveSource = (src: string) => {
    const cached = sourceCache.get(src);
    if (cached) {
      return cached;
    }

    const pending = (async () => {
      if (src.startsWith("data:image/")) {
        return src;
      }

      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(`Image request failed with status ${response.status}.`);
      }

      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) {
        throw new Error("The image source returned an unsupported file.");
      }

      return blobToDataUrl(blob);
    })();

    sourceCache.set(src, pending);
    return pending;
  };

  return async (element: ImageElement) => {
    const cacheKey = [
      element.src,
      element.width,
      element.height,
      element.cornerRadius,
      element.fit,
    ].join("|");
    const cached = renderCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const pending = (async () => {
      const source = await resolveSource(element.src);
      const isCover = element.fit === "cover";
      const isSvg = getDataUrlMimeType(source) === "image/svg+xml";
      const requiresRasterization =
        isCover ||
        isSvg ||
        element.cornerRadius > 0 ||
        getDataUrlMimeType(source) === "image/webp";

      if (!requiresRasterization) {
        return source;
      }

      // Vectors have no useful natural size, so render them sharp at the
      // element's box instead.
      const usesElementBox = isCover || isSvg || element.cornerRadius > 0;
      const scale = isSvg ? SVG_RASTER_SCALE : 1;
      return rasterizeImage(
        source,
        usesElementBox ? element.width * scale : undefined,
        usesElementBox ? element.height * scale : undefined,
        element.cornerRadius * scale,
        isCover,
      );
    })();

    renderCache.set(cacheKey, pending);
    return pending;
  };
}

function addShapeElement(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  element: ShapeElement,
) {
  const shapeType =
    element.shapeType === "circle"
      ? pptx.ShapeType.ellipse
      : element.shapeType === "roundedRectangle"
        ? pptx.ShapeType.roundRect
        : pptx.ShapeType.rect;
  const strokeWidth = Math.max(0, logicalPixelsToPoints(element.strokeWidth));
  const minDimension = Math.max(1, Math.min(element.width, element.height));
  const cornerRatio = Math.min(
    1,
    Math.max(0, ((element.cornerRadius ?? 0) * 2) / minDimension),
  );

  slide.addShape(shapeType, {
    ...getPowerPointBox(element),
    fill:
      element.fill === "transparent"
        ? { type: "none" }
        : {
            color: toHexColor(element.fill, "FFFFFF"),
            transparency: toTransparency(element.opacity),
          },
    line:
      strokeWidth > 0
        ? {
            color: toHexColor(element.stroke),
            transparency: toTransparency(element.opacity),
            width: strokeWidth,
            ...(element.dashed ? { dashType: "dash" as const } : {}),
          }
        : { type: "none" },
    objectName: element.id,
    rectRadius:
      element.shapeType === "roundedRectangle" ? cornerRatio : undefined,
    rotate: element.rotation,
  });
}

function addTextElement(slide: PptxGenJS.Slide, element: TextElement) {
  const color = toHexColor(element.color);

  slide.addText(element.text, {
    ...getPowerPointBox(element),
    align: element.align,
    bold: element.fontWeight >= 600,
    charSpacing: logicalPixelsToPoints(element.letterSpacing),
    color,
    fit: "none",
    fontFace: element.fontFamily,
    fontSize: logicalPixelsToPoints(element.fontSize),
    italic: element.italic,
    lineSpacingMultiple: element.lineHeight,
    margin: logicalPixelsToPoints(element.padding ?? 0),
    objectName: element.id,
    rotate: element.rotation,
    transparency: toTransparency(element.opacity),
    underline:
      element.textDecoration === "underline"
        ? { color, style: "sng" }
        : undefined,
    valign: element.verticalAlign,
    wrap: true,
  });
}

function addMissingImagePlaceholder(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  element: ImageElement,
) {
  const box = getPowerPointBox(element);

  slide.addShape(pptx.ShapeType.rect, {
    ...box,
    fill: { color: "F4EEEE" },
    line: { color: "D9BFC2", width: 0.5 },
    objectName: `${element.id}-fallback`,
    rotate: element.rotation,
  });
  slide.addText("Image unavailable", {
    ...box,
    align: "center",
    color: "8A666A",
    fontFace: "Arial",
    fontSize: Math.min(
      14,
      Math.max(7, logicalPixelsToPoints(element.height / 8)),
    ),
    margin: 0,
    rotate: element.rotation,
    valign: "middle",
  });
}

async function addImageElement(
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  element: ImageElement,
  resolveImageData: (element: ImageElement) => Promise<string>,
) {
  try {
    const data = await resolveImageData(element);
    slide.addImage({
      ...getPowerPointBox(element),
      altText: "Presentation image",
      data,
      objectName: element.id,
      rotate: element.rotation,
      transparency: toTransparency(element.opacity),
    });
    return true;
  } catch {
    addMissingImagePlaceholder(pptx, slide, element);
    return false;
  }
}

export async function exportPresentationToPptx(
  presentation: Presentation,
): Promise<PptxExportResult> {
  const { default: PptxGenJSConstructor } = await import("pptxgenjs");
  const pptx = new PptxGenJSConstructor();
  const resolveImageData = createImageDataResolver();
  let missingImageCount = 0;

  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Deck Builder";
  pptx.company = "Deck Builder";
  pptx.subject = "Presentation exported from Deck Builder";
  pptx.title = presentation.title;
  pptx.theme = {
    bodyFontFace: "Plus Jakarta Sans",
    headFontFace: "Plus Jakarta Sans",
  };

  for (const sourceSlide of presentation.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: toHexColor(sourceSlide.background, "FFFFFF") };

    for (const element of sourceSlide.elements) {
      if (element.visible === false) {
        continue;
      }

      switch (element.type) {
        case "shape":
          addShapeElement(pptx, slide, element);
          break;
        case "text":
          addTextElement(slide, element);
          break;
        case "image": {
          const didAddImage = await addImageElement(
            pptx,
            slide,
            element,
            resolveImageData,
          );
          if (!didAddImage) {
            missingImageCount += 1;
          }
          break;
        }
      }
    }
  }

  const fileName = sanitizeFileName(presentation.title);
  await pptx.writeFile({ compression: true, fileName });

  return { fileName, missingImageCount };
}
