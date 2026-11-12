import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readConnection } from "../lib/deck-service/connection";
import { addSchema, createSchema, idSchema, revisionSchema, updateSchema, startWorkSchema, finishWorkSchema } from "../lib/deck-service/schemas";

async function call(name: string, args: unknown) {
  try {
    const connection = await readConnection();
    const response = await fetch(`${connection.url}/tools/${name}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${connection.token}` },
      body: JSON.stringify(args), redirect: "error", signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json();
    return { isError: !response.ok, content: [{ type: "text" as const, text: JSON.stringify(result) }], structuredContent: result };
  } catch {
    const result = { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: "Start npm run deck-service in the project directory, then retry." } };
    return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(result) }], structuredContent: result };
  }
}
// Shared by every agent client; read per call so edits apply without restarting.
const PLAYBOOK_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../docs/agent-guide/playbook.md");
const readPlaybook = () => readFile(PLAYBOOK_PATH, "utf8");

async function main() {
  const server = new McpServer({ name: "wknd-deck-builder", version: "0.1.0" }, {
    instructions: "Build WKND decks through tools, never by editing application source. Before planning or writing a new deck, call get_deck_playbook and follow it: brief, one storyline approval from the user, then write copy and build live without asking again. Read list_layouts first. Only its 31 layouts are supported, at most 60 slides. For a NEW presentation, default to LIVE creation: create_deck with live:true, plannedSlides and ONE cover slide, then add_slide one at a time using each returned revision. The deck appears in the connected Library immediately after the cover commits; the user can click it to watch. Keep the returned agentWork.id as runId and ownerToken, and supply BOTH on live add/update/finish calls. Always finish_deck as completed (only if all planned slides exist), partial or failed. Do not add artificial delays or wait for the user to click. Bulk create without live is allowed when explicitly requested. For an existing presentation start_deck_run before a multi-step edit; interrupted jobs require a new run after reading current deck. Use short copy and placeholders for unknown facts. Before revising, call get_deck and use its current revision and slide IDs. Use unique requestId values per operation, reuse only when retrying the identical request. Preserve manual changes; do not replace a stale source unless the user asks. Text validation is estimated; use the existing browser preview. Never print tokens. Return the deck title and library link when appropriate.",
  });
  server.registerTool("list_layouts", { description: "Read supported DeckSpec layouts, fields, limits and examples. Filter to one layout to keep the response small.", inputSchema: z.object({ category: z.string().optional(), layoutId: z.string().optional() }) }, args => call("list_layouts", args));
  server.registerTool("get_brand_styles", { description: "Read existing WKND themes, palette, typography, grid and asset references.", inputSchema: z.object({}) }, args => call("get_brand_styles", args));
  server.registerTool("create_deck", { description: "Build and atomically save a new deck from a DeckSpec. Returns stable deck/slide IDs and editor/preview URLs.", inputSchema: createSchema }, args => call("create_deck", args));
  server.registerTool("get_deck", { description: "Read current revision, slide IDs, source specs and current text. Elements are omitted unless explicitly requested.", inputSchema: z.object({ deckId: idSchema, slideId: idSchema.optional(), includeElements: z.boolean().optional() }) }, args => call("get_deck", args));
  server.registerTool("add_slide", { description: "Build one supported slide and insert after afterSlideId, or append if omitted. Requires current revision.", inputSchema: addSchema }, args => call("add_slide", args));
  server.registerTool("update_slide", { description: "Rebuild only the target slide. Supply exactly one contentPatch or complete slideSpec. Arrays replace whole arrays. Manual-source replacement additionally requires replaceManual:true.", inputSchema: updateSchema }, args => call("update_slide", args));
  server.registerTool("preview_deck", { description: "Return a local manual preview URL rendered by Deck Builder. No automatic screenshot or exact browser validation in this MVP.", inputSchema: z.object({ deckId: idSchema, revision: revisionSchema.optional() }) }, args => call("preview_deck", args));
  server.registerTool("start_deck_run", { description: "Start or resume an agent job on an existing deck. Returns run ID and private ownerToken; an already active owner cannot be replaced.", inputSchema: startWorkSchema }, args => call("start_deck_run", args));
  server.registerTool("finish_deck", { description: "Mark a live deck job completed, partial, or failed after its last commit. Requires current revision, runId and ownerToken. Do this before ending the response.", inputSchema: finishWorkSchema }, args => call("finish_deck", args));
  server.registerTool("get_deck_playbook", { description: "Read the WKND deck playbook: the conversation workflow (brief, storyline approval, build), storytelling rules and copywriting voice. Call before planning a new deck.", inputSchema: z.object({}) }, async () => {
    try {
      const playbook = await readPlaybook();
      return { content: [{ type: "text" as const, text: playbook }], structuredContent: { ok: true, playbook } };
    } catch {
      const result = { ok: false, error: { code: "PLAYBOOK_UNAVAILABLE", message: "docs/agent-guide/playbook.md could not be read." } };
      return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(result) }], structuredContent: result };
    }
  });
  server.registerPrompt("plan_deck", { title: "Plan a WKND deck", description: "Start a deck conversation: brief, storyline approval, then live build in the Deck Builder.", argsSchema: { brief: z.string().optional().describe("What the deck is about, for whom, and anything already known.") } }, async ({ brief }) => ({
    messages: [{ role: "user" as const, content: { type: "text" as const, text: `Follow this playbook for a new WKND deck. Use the deck_builder tools only; do not edit source code.\n\n${await readPlaybook()}\n\n---\n\n${brief?.trim() ? `Brief from the user:\n\n${brief.trim()}\n\nStart at step 1: ask only about real gaps, or propose the storyline if the brief is enough.` : "Start at step 1: ask me for the brief."}` } }],
  }));
  await server.connect(new StdioServerTransport());
}
main().catch(() => { console.error("MCP startup failed. Check installed dependencies and runtime."); process.exitCode = 1; });
