import { SUPABASE_ORIGIN } from "@/lib/cloud/supabase";

// Slide photos in cloud storage live on another origin. Loading them with
// CORS keeps canvases readable (mockup rendering reads pixels back). Other
// remote URLs keep the default, because a server without CORS headers would
// otherwise fail to load at all.
export function applyImageCrossOrigin(image: HTMLImageElement, src: string) {
  if (SUPABASE_ORIGIN && src.startsWith(`${SUPABASE_ORIGIN}/`)) {
    image.crossOrigin = "anonymous";
  }
}
