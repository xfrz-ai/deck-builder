// `wknd-deck guide`: the skill and its references. Storytelling and
// copywriting come from the shared playbook, so the CLI and MCP agents follow
// the same rules.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CliError } from "./api";

export interface GuidePaths { skillDir: string; playbook: string }

// Topics other than the playbook sections are files in the skill's
// references/ folder.
export const GUIDE_TOPICS = ["storytelling", "copywriting"] as const;
export type GuideTopic = (typeof GUIDE_TOPICS)[number];

const PLAYBOOK_SECTIONS: Partial<Record<GuideTopic, string>> = {
  storytelling: "## 2. Storytelling",
  copywriting: "## 3. Copywriting",
};

function section(text: string, heading: string) {
  const start = text.indexOf(heading);
  if (start < 0) throw new CliError("GUIDE_UNAVAILABLE", `The playbook has no "${heading}" section.`);
  const rest = text.slice(start + heading.length);
  const end = rest.search(/\n(?:---\n|## )/);
  return (heading + (end < 0 ? rest : rest.slice(0, end))).trim();
}

async function read(file: string) {
  try { return await readFile(file, "utf8"); }
  catch { throw new CliError("GUIDE_UNAVAILABLE", `${file} could not be read.`); }
}

export async function readGuide(paths: GuidePaths, topic?: string) {
  if (!topic) return (await read(join(paths.skillDir, "SKILL.md"))).replace(/^---\n[\s\S]*?\n---\n/, "").trim();
  if (!(GUIDE_TOPICS as readonly string[]).includes(topic)) {
    throw new CliError("UNKNOWN_TOPIC", `Unknown guide topic "${topic}". Topics: ${GUIDE_TOPICS.join(", ")}.`, [], 2);
  }
  const heading = PLAYBOOK_SECTIONS[topic as GuideTopic];
  if (heading) return section(await read(paths.playbook), heading);
  return (await read(join(paths.skillDir, "references", `${topic}.md`))).trim();
}
