import { validateImageFile } from "@/lib/image/image-file";
import type { TeamPhoto } from "@/types/team";

// Keep portraits small enough to save alongside the deck in browser storage.
export async function loadTeamPhoto(file: File): Promise<TeamPhoto> {
  const error = validateImageFile(file);
  if (error) throw new Error(error);

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("The image file is invalid.");
    const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The photo could not be prepared.");
    context.drawImage(image, 0, 0, width, height);
    return { src: canvas.toDataURL("image/webp", 0.86), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
