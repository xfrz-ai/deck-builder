import { mkdir, open, readFile, readdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { isPresentation } from "@/lib/presentation/validation";
import { DeckError, type DeckDocument } from "./deck-document";
import { documentSchema, deletedDocumentSchema, idSchema } from "./schemas";

export async function atomicWrite(file: string, data: unknown) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(JSON.stringify(data)); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
  }
}

export class FileRepository {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly directory: string) {}

  async initialize() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await mkdir(join(this.directory, "decks"), { recursive: true, mode: 0o700 });
    await mkdir(join(this.directory, "backups"), { recursive: true, mode: 0o700 });
  }

  // All read/modify/write operations pass through one queue in the single service process.
  transaction<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private path(deckId: string) {
    if (!idSchema.safeParse(deckId).success) throw new DeckError("INVALID_DECK_ID", "Invalid deck ID.");
    return join(this.directory, "decks", `${deckId}.json`);
  }

  async read(deckId: string): Promise<DeckDocument> {
    let value: DeckDocument;
    try { value = JSON.parse(await readFile(this.path(deckId), "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new DeckError("DECK_NOT_FOUND", "Deck not found.", 404);
      if (error instanceof SyntaxError) throw new DeckError("INVALID_DOCUMENT", "The stored deck is not valid JSON; restore a backup.", 500);
      throw error;
    }
    const deleted = deletedDocumentSchema.safeParse(value);
    if (deleted.success && deleted.data.deckId === deckId) throw new DeckError("DECK_DELETED", "This presentation was deleted from the Library.", 410);
    if (!documentSchema.safeParse(value).success ||
        !isPresentation(value.presentation) || value.presentation.id !== deckId ||
        !value.sources || !value.defaults || !value.receipts || value.validation !== "estimated") {
      throw new DeckError("INVALID_DOCUMENT", "The stored deck document is invalid; restore a backup.", 500);
    }
    return value;
  }

  async write(document: DeckDocument) {
    await atomicWrite(this.path(document.presentation.id), document);
  }

  async remove(deckId: string, revision: number) {
    // Remove all content atomically. A small durable marker prevents delayed
    // create retries from resurrecting a deck after the user deletes it.
    await atomicWrite(this.path(deckId), deletedDocumentSchema.parse({
      storageVersion: 1, deleted: true, deckId, revision, deletedAt: new Date().toISOString(),
    }));
  }

  async ids() {
    return (await readdir(join(this.directory, "decks"))).filter(file => file.endsWith(".json") && idSchema.safeParse(file.slice(0, -5)).success).map(file => file.slice(0, -5));
  }

  async backup(raw: string) {
    // The exact original storage string is preserved, not parsed and rebuilt.
    const backupId = createHash("sha256").update(raw).digest("hex");
    await atomicWrite(join(this.directory, "backups", `${backupId}.json`), {
      storageKey: "presentation-editor-storage", raw, savedAt: new Date().toISOString(),
    });
    return { backupId };
  }

  async acquireWriter() {
    const lock = join(this.directory, "writer.lock");
    try {
      const handle = await open(lock, "wx", 0o600);
      try { await handle.writeFile(String(process.pid)); }
      finally { await handle.close(); }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      throw new DeckError("SERVICE_ALREADY_RUNNING", "This data directory already has a writer. Stop it first. After a crash, verify the PID in writer.lock is stopped before removing the lock.", 409);
    }
    return () => unlink(lock);
  }
}
