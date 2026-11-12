import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FileRepository, atomicWrite } from "../lib/deck-service/file-repository";
import { DeckService } from "../lib/deck-service/deck-service";
import { createDeckHttpServer } from "../lib/deck-service/http-server";
import { dataDirectory, localUrl } from "../lib/deck-service/connection";

async function main() {
  const directory = dataDirectory();
  const repository = new FileRepository(directory);
  await repository.initialize();
  const release = await repository.acquireWriter();
  let server: ReturnType<typeof createDeckHttpServer> | undefined;
  try {
    const port = Number(process.env.DECK_SERVICE_PORT ?? 8790);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid DECK_SERVICE_PORT.");
    let token = randomBytes(32).toString("hex");
    const connectionFile = join(directory, "connection.json");
    try {
      const prior = JSON.parse(await readFile(connectionFile, "utf8"));
      if (typeof prior.token === "string" && /^[a-f0-9]{64}$/.test(prior.token)) token = prior.token;
    } catch { /* First launch creates a token. */ }
    const connection = { url: `http://127.0.0.1:${port}`, appUrl: localUrl(process.env.DECK_APP_URL ?? "http://localhost:3000"), token };
    const running = createDeckHttpServer(new DeckService(repository), connection);
    server = running;
    await new Promise<void>((resolve, reject) => { running.once("error", reject); running.listen(port, "127.0.0.1", resolve); });
    await atomicWrite(connectionFile, connection);
    console.error(`Deck service ready at ${connection.url}. Local credentials are in .deck-builder/connection.json; do not share that file.`);
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      running.closeEventStreams();
      running.close(() => { void release().then(() => process.exit(0)); });
      running.closeIdleConnections();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  } catch (error) {
    if (server?.listening) {
      server.closeEventStreams();
      await new Promise<void>(resolve => server!.close(() => resolve()));
    }
    await release(); throw error;
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Deck service failed."); process.exitCode = 1; });
