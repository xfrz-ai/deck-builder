export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;
export const IMAGE_FILE_ACCEPT = "image/png,image/jpeg,image/webp";

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export interface LoadedImageFile {
  dataUrl: string;
  height: number;
  width: number;
}

export function validateImageFile(file: File) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return "Choose a PNG, JPG, or WEBP image.";
  }

  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return "Image is too large. Maximum size is 5 MB.";
  }

  return null;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("The image could not be read."));
      }
    };
    reader.readAsDataURL(file);
  });
}

function decodeImageDimensions(src: string) {
  return new Promise<{ height: number; width: number }>((resolve, reject) => {
    const image = new Image();

    image.onerror = () => reject(new Error("The image file is invalid."));
    image.onload = () => {
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        reject(new Error("The image file is invalid."));
        return;
      }

      resolve({ height: image.naturalHeight, width: image.naturalWidth });
    };
    image.src = src;
  });
}

export async function loadImageFile(file: File): Promise<LoadedImageFile> {
  const validationError = validateImageFile(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const dataUrl = await readFileAsDataUrl(file);
  const dimensions = await decodeImageDimensions(dataUrl);

  return { dataUrl, ...dimensions };
}
