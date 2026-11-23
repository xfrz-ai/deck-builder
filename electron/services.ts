// The local services behind the app, started by the main process:
// - the deck service (in this process): agent decks as JSON files, the
//   Library's live updates and the MCP tools' backend;
// - the AI bridge (a child process): runs the user's own Claude Code headless
//   for "Create with AI" and the slide chats.

import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";

import type { LocalConnection } from "@/lib/deck-service/connection";
import { DeckService } from "@/lib/deck-service/deck-service";
import { atomicWrite, FileRepository } from "@/lib/deck-service/file-repository";
import { createDeckHttpServer } from "@/lib/deck-service/http-server";

export interface RunningService {
  stop(): Promise<void>;
}

export async function startDeckService(options: { dataDir: string; port: number; appUrl: string }) {
  const repository = new FileRepository(options.dataDir);
  await repository.initialize();
  // The app runs as a single instance, so a lock left behind by a crash is stale.
  await rm(join(options.dataDir, "writer.lock"), { force: true });
  const release = await repository.acquireWriter();

  try {
    const connectionFile = join(options.dataDir, "connection.json");
    let token = randomBytes(32).toString("hex");
    try {
      const prior = JSON.parse(await readFile(connectionFile, "utf8"));
      if (typeof prior.token === "string" && /^[a-f0-9]{64}$/.test(prior.token)) token = prior.token;
    } catch {
      // First launch creates a token.
    }

    const connection: LocalConnection = { url: `http://127.0.0.1:${options.port}`, appUrl: options.appUrl, token };
    const server = createDeckHttpServer(new DeckService(repository), connection);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(options.port, "127.0.0.1", resolve);
    });
    // The MCP server (started by the agent) reads the connection from here.
    await atomicWrite(connectionFile, connection);

    return {
      connection,
      async stop() {
        server.closeEventStreams();
        server.closeIdleConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        await release();
      },
    };
  } catch (error) {
    await release();
    throw error;
  }
}

export function startAiBridge(options: { script: string; dataDir: string; mcpBundle: string; playbook: string }): RunningService {
  const child: ChildProcess = spawn(process.execPath, [options.script], {
    env: {
      ...process.env,
      // Run Electron's binary as plain Node.
      ELECTRON_RUN_AS_NODE: "1",
      DECK_DATA_DIR: options.dataDir,
      DECK_MCP_BUNDLE: options.mcpBundle,
      DECK_PLAYBOOK_PATH: options.playbook,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [child.stdout, child.stderr]) {
    if (stream) createInterface({ input: stream }).on("line", (line) => console.log(`[ai-bridge] ${line}`));
  }
  child.on("exit", (code, signal) => {
    if (signal !== "SIGTERM") console.error(`[ai-bridge] stopped (${signal ?? `exit ${code}`})`);
  });

  return {
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      await new Promise<void>((resolve) => {
        child.once("exit", () => resolve());
        child.kill("SIGTERM");
      });
    },
  };
}
