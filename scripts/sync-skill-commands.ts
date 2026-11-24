// Writes the command table in skills/wknd-deck/SKILL.md from the CLI's
// command registry, so the skill never drifts from `wknd-deck --help`.
// `npm run skill:sync` updates it; the CLI test fails while it is out of date.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMANDS } from "../lib/deck-cli/commands";

const START = "<!-- commands:start — generated from the CLI's command registry by `npm run skill:sync`; do not edit by hand -->";
const END = "<!-- commands:end -->";

export function skillCommandTable() {
  const cell = (text: string) => text.replaceAll("|", "\\|");
  return [
    START,
    "| Command | What it does |",
    "|---|---|",
    ...COMMANDS.map(command => `| \`wknd-deck ${cell(command.usage)}\` | ${cell(command.summary)} |`),
    END,
  ].join("\n");
}

async function main() {
  const file = resolve(dirname(fileURLToPath(import.meta.url)), "../skills/wknd-deck/SKILL.md");
  const skill = await readFile(file, "utf8");
  const start = skill.indexOf("<!-- commands:start");
  const end = skill.indexOf(END);
  if (start < 0 || end < 0) throw new Error("SKILL.md has no commands:start / commands:end markers.");
  const updated = skill.slice(0, start) + skillCommandTable() + skill.slice(end + END.length);
  if (updated !== skill) await writeFile(file, updated);
  console.log(updated === skill ? "SKILL.md command table is up to date." : "Updated the command table in SKILL.md.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
