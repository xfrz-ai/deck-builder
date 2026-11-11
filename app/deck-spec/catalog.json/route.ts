import { getDeckSpecCatalog } from "@/lib/deck-spec/layout-catalog";

// Prerendered to /deck-spec/catalog.json by the static export, so agents and
// tools can read the layouts and fields a deck spec may use.
export const dynamic = "force-static";

export function GET() {
  return Response.json(getDeckSpecCatalog());
}
