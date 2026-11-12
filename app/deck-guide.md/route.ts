import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Prerendered to /deck-guide.md by the static export, so any AI agent can read
// the deck guide from the deployed app without access to the repository.
export const dynamic = "force-static";

export async function GET() {
  const guide = await readFile(join(process.cwd(), "DECK-GUIDE.md"), "utf8");
  return new Response(guide, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
