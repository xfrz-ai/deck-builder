import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { DeckError } from "./deck-document";

export interface LocalConnection { url: string; token: string; appUrl: string }
export function dataDirectory() { return resolve(process.env.DECK_DATA_DIR ?? ".deck-builder"); }
export function localUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new DeckError("INVALID_LOCAL_URL", "Use an http://127.0.0.1:port or http://localhost:port origin.");
  }
  return url.origin;
}
export async function readConnection(directory = dataDirectory()): Promise<LocalConnection> {
  try {
    const value = JSON.parse(await readFile(join(directory, "connection.json"), "utf8"));
    return { url: localUrl(value.url), appUrl: localUrl(value.appUrl), token: String(value.token) };
  } catch { throw new DeckError("SERVICE_UNAVAILABLE", "Start npm run deck-service in the project directory first.", 503); }
}
