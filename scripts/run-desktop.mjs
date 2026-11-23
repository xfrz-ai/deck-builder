#!/usr/bin/env node
// Opens the desktop app in development. Some terminals (for example ones
// started by VS Code or other Electron apps) set ELECTRON_RUN_AS_NODE, which
// would make Electron run as plain Node without a window, so it is cleared.

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const electron = createRequire(import.meta.url)("electron");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electron, [root, ...process.argv.slice(2)], { cwd: root, env, stdio: "inherit" });
child.on("exit", (code) => { process.exitCode = code ?? 0; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
