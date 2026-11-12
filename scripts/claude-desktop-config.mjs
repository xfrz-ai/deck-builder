#!/usr/bin/env node
// Register the deck_builder MCP server with Claude Desktop.
//   node scripts/claude-desktop-config.mjs          print the config entry
//   node scripts/claude-desktop-config.mjs --write  merge it into Claude Desktop's config (backup first)
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deckMcpServer } from "./deck-mcp-config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(process.env.DECK_DATA_DIR ?? resolve(root, ".deck-builder"));
const entry = deckMcpServer(root, dataDir);
// Homebrew's versioned Cellar path breaks on upgrade; its opt/ symlink does not.
const cellar = entry.command.match(/^(.*)\/Cellar\/([^/]+)\/[^/]+\/bin\/node$/);
if (cellar && existsSync(`${cellar[1]}/opt/${cellar[2]}/bin/node`)) entry.command = `${cellar[1]}/opt/${cellar[2]}/bin/node`;

function desktopConfigPath() {
  if (process.platform === "darwin") return join(homedir(), "Library/Application Support/Claude/claude_desktop_config.json");
  if (process.platform === "win32") return join(process.env.APPDATA ?? join(homedir(), "AppData/Roaming"), "Claude/claude_desktop_config.json");
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "Claude/claude_desktop_config.json");
}

if (!process.argv.includes("--write")) {
  console.log(JSON.stringify({ mcpServers: { deck_builder: entry } }, null, 2));
  console.error(`\nMerge this into ${desktopConfigPath()}, or rerun with --write.`);
} else {
  const path = desktopConfigPath();
  let config = {};
  let existed = true;
  try { config = JSON.parse(await readFile(path, "utf8")); } catch (error) {
    if (error?.code !== "ENOENT") { console.error(`Could not parse ${path}; fix or move it, then retry.`); process.exit(1); }
    existed = false;
  }
  if (existed) {
    const backup = `${path}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    await copyFile(path, backup);
    console.log(`Backup: ${backup}`);
  }
  config.mcpServers = { ...config.mcpServers, deck_builder: entry };
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`);
  await rename(temporary, path);
  console.log(`Added deck_builder to ${path}. Quit and reopen Claude Desktop to load it.`);
}
