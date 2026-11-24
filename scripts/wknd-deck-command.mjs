// How the AI bridge runs the `wknd-deck` CLI for the "claude-cli" agent, and
// where that agent's skill comes from.
//
// In a checkout of the project the CLI runs from source through tsx. Inside
// the desktop app (electron/) there is no tsx and no source: WKND_DECK_CLI_BUNDLE
// points at the prebuilt CLI and WKND_DECK_SKILL_DIR at the bundled skill, and
// Electron's own binary runs the CLI as Node, like the deck MCP server.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

// `{ command, args, env }` for the CLI, or null when this install has none.
export function wkndDeckCommand(root) {
  const bundle = process.env.WKND_DECK_CLI_BUNDLE;
  if (bundle) {
    if (!existsSync(bundle)) return null;
    return {
      command: process.execPath,
      args: [bundle],
      env: {
        ELECTRON_RUN_AS_NODE: "1",
        WKND_DECK_SKILL_DIR: wkndDeckSkillDir(root),
        ...(process.env.DECK_PLAYBOOK_PATH ? { DECK_PLAYBOOK_PATH: process.env.DECK_PLAYBOOK_PATH } : {}),
      },
    };
  }
  const source = resolve(root, "scripts/wknd-deck.ts");
  if (!existsSync(source)) return null;
  return {
    command: process.execPath,
    args: ["--import", resolve(root, "node_modules/tsx/dist/loader.mjs"), source],
    env: { TSX_TSCONFIG_PATH: resolve(root, "tsconfig.json") },
  };
}

// A shell script that runs the CLI against the decks in `dataDir`. The agent
// calls it as `wknd-deck`, from a bin folder on its PATH.
export function wkndDeckShim(cli, dataDir) {
  const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
  return [
    "#!/bin/sh",
    `export DECK_DATA_DIR=${quote(dataDir)}`,
    ...Object.entries(cli.env).map(([name, value]) => `export ${name}=${quote(value)}`),
    `exec ${[cli.command, ...cli.args].map(quote).join(" ")} "$@"`,
    "",
  ].join("\n");
}

export function wkndDeckSkillDir(root) {
  return process.env.WKND_DECK_SKILL_DIR ?? resolve(root, "skills/wknd-deck");
}
