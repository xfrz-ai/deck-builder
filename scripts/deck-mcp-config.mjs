// MCP server entry for clients that may start it outside the project directory
// (Claude Desktop has no cwd option). Absolute loader and tsconfig paths keep the
// `@/` imports resolvable from any working directory.
import { resolve } from "node:path";

export function deckMcpServer(root, dataDir) {
  return {
    command: process.execPath,
    args: ["--import", resolve(root, "node_modules/tsx/dist/loader.mjs"), resolve(root, "scripts/deck-mcp.ts")],
    env: { DECK_DATA_DIR: dataDir, TSX_TSCONFIG_PATH: resolve(root, "tsconfig.json") },
  };
}
