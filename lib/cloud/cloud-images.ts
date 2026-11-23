import { getSupabase } from "@/lib/cloud/supabase";

// The editor keeps uploaded photos inline as data URLs. Stored that way, one
// deck can weigh tens of megabytes and every autosave would resend it. Before
// a deck goes to the database, each large inline image is uploaded once to
// the `deck-images` bucket and replaced by its public URL.

const BUCKET = "deck-images";
// Small inline images (icons, tiny SVGs) stay in the deck.
const MIN_EXTERNALIZED_LENGTH = 16 * 1024;
const DATA_URL_PATTERN = /^data:(image\/[a-z0-9.+-]+);base64,/i;

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

// Same data URL → same upload, for the whole session.
const uploads = new Map<string, Promise<string>>();

function isExternalizable(value: string) {
  if (value.length < MIN_EXTERNALIZED_LENGTH) return false;
  const match = DATA_URL_PATTERN.exec(value);
  return Boolean(match && EXTENSIONS[match[1].toLowerCase()]);
}

function decodeDataUrl(dataUrl: string) {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) throw new Error("Unsupported image data.");
  const binary = atob(dataUrl.slice(match[0].length));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, mimeType: match[1].toLowerCase() };
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isDuplicateError(error: { message?: string; statusCode?: string | number } | null) {
  if (!error) return false;
  return String(error.statusCode) === "409" || /already exists|duplicate/i.test(error.message ?? "");
}

async function uploadDataUrl(dataUrl: string, userId: string) {
  const { bytes, mimeType } = decodeDataUrl(dataUrl);
  // Named by content, so re-uploads are no-ops and URLs can't be guessed.
  const path = `${userId}/${await sha256Hex(bytes)}.${EXTENSIONS[mimeType]}`;
  const storage = getSupabase().storage.from(BUCKET);
  const { error } = await storage.upload(path, new Blob([bytes], { type: mimeType }), {
    cacheControl: "31536000",
    contentType: mimeType,
    upsert: false,
  });
  if (error && !isDuplicateError(error)) {
    throw new Error(`An image could not be uploaded: ${error.message}`);
  }
  return storage.getPublicUrl(path).data.publicUrl;
}

function uploadOnce(dataUrl: string, userId: string) {
  let pending = uploads.get(dataUrl);
  if (!pending) {
    pending = uploadDataUrl(dataUrl, userId);
    uploads.set(dataUrl, pending);
    // A failed upload is retried on the next save.
    pending.catch(() => uploads.delete(dataUrl));
  }
  return pending;
}

function collectDataUrls(value: unknown, found: Set<string>) {
  if (typeof value === "string") {
    if (isExternalizable(value)) found.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectDataUrls(item, found);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectDataUrls(item, found);
  }
}

// Returns the same object when nothing inside it changed.
function replaceStrings(value: unknown, replacements: Map<string, string>): unknown {
  if (typeof value === "string") return replacements.get(value) ?? value;
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const replaced = replaceStrings(item, replacements);
      changed ||= replaced !== item;
      return replaced;
    });
    return changed ? next : value;
  }
  if (value && typeof value === "object") {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const replaced = replaceStrings(item, replacements);
      changed ||= replaced !== item;
      next[key] = replaced;
    }
    return changed ? next : value;
  }
  return value;
}

// Uploads the large inline images in `value` and returns a copy that points
// at their storage URLs.
export async function externalizeImages<T>(value: T, userId: string): Promise<T> {
  const found = new Set<string>();
  collectDataUrls(value, found);
  if (found.size === 0) return value;

  const entries = await Promise.all(
    Array.from(found, async (dataUrl) => [dataUrl, await uploadOnce(dataUrl, userId)] as const),
  );
  return replaceStrings(value, new Map(entries)) as T;
}
