// MCP server entry for clients that may start it outside the project directory
// (Claude Desktop has no cwd option). Absolute loader and tsconfig paths keep the
// `@/` imports resolvable from any working directory.
//
// Inside the desktop app (electron/) there is no tsx: DECK_MCP_BUNDLE points at
// the prebuilt server, and Electron's own binary runs it as Node.
import { resolve } from "node:path";

export function deckMcpServer(root, dataDir) {
  const bundle = process.env.DECK_MCP_BUNDLE;
  if (bundle) {
    return {
      command: process.execPath,
      args: [bundle],
      env: {
        DECK_DATA_DIR: dataDir,
        ELECTRON_RUN_AS_NODE: "1",
        ...(process.env.DECK_PLAYBOOK_PATH ? { DECK_PLAYBOOK_PATH: process.env.DECK_PLAYBOOK_PATH } : {}),
      },
    };
  }
  return {
    command: process.execPath,
    args: ["--import", resolve(root, "node_modules/tsx/dist/loader.mjs"), resolve(root, "scripts/deck-mcp.ts")],
    env: { DECK_DATA_DIR: dataDir, TSX_TSCONFIG_PATH: resolve(root, "tsconfig.json") },
  };
}
