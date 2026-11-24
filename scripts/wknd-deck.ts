#!/usr/bin/env node
// wknd-deck: the agent-facing CLI of the Deck Builder. See skills/wknd-deck/SKILL.md.
//
// It finds the local deck service through connection.json in the data folder:
// DECK_DATA_DIR, or .deck-builder in this project. The guide comes from
// WKND_DECK_SKILL_DIR and DECK_PLAYBOOK_PATH, or from this project.

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../lib/deck-cli/cli";
import { CliError } from "../lib/deck-cli/api";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readStdin() {
  if (process.stdin.isTTY) throw new CliError("NO_INPUT", "Pass JSON on stdin, for example with a heredoc: wknd-deck check - <<'EOF' … EOF", [], 2);
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function openUrl(url: string) {
  return new Promise<void>((done, fail) => {
    const [command, args] = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]] : ["xdg-open", [url]];
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.once("error", () => fail(new CliError("OPEN_FAILED", "Could not open a browser on this computer.")));
    child.once("spawn", () => { child.unref(); done(); });
  });
}

async function main() {
  const line = (stream: NodeJS.WriteStream) => (text: string) => { stream.write(text.endsWith("\n") ? text : `${text}\n`); };
  process.exitCode = await runCli(process.argv.slice(2), {
    dataDir: resolve(process.env.DECK_DATA_DIR ?? resolve(root, ".deck-builder")),
    guide: {
      skillDir: process.env.WKND_DECK_SKILL_DIR ?? resolve(root, "skills/wknd-deck"),
      playbook: process.env.DECK_PLAYBOOK_PATH ?? resolve(root, "docs/agent-guide/playbook.md"),
    },
    stdout: line(process.stdout),
    stderr: line(process.stderr),
    readStdin,
    openUrl,
  });
}

void main();
