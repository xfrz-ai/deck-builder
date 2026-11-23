// Apps opened from Finder or the Dock don't get the PATH of the user's shell,
// so `claude` and `codex` (installed by npm, Homebrew or their own installers)
// would not be found. Ask the login shell for its PATH once at startup.

import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const MARKER = "__WKND_DECK_PATH__";

function loginShellPath() {
  return new Promise<string | null>((resolve) => {
    const shell = process.env.SHELL || (process.platform === "darwin" ? "/bin/zsh" : "/bin/bash");
    execFile(shell, ["-ilc", `printf "${MARKER}%s${MARKER}" "$PATH"`], { timeout: 5000 }, (_error, stdout) => {
      const match = new RegExp(`${MARKER}(.*)${MARKER}`).exec(String(stdout ?? ""));
      resolve(match?.[1] || null);
    });
  });
}

export async function fixPath() {
  if (process.platform === "win32") return;
  const home = homedir();
  // Common install locations, in case the shell can't be asked.
  const known = [
    join(home, ".local", "bin"),
    join(home, ".claude", "local"),
    join(home, ".npm-global", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  const fromShell = (await loginShellPath())?.split(delimiter) ?? [];
  const current = (process.env.PATH ?? "").split(delimiter);
  process.env.PATH = [...new Set([...fromShell, ...current, ...known])].filter(Boolean).join(delimiter);
}
