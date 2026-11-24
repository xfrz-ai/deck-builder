// The wknd-deck CLI talks to the local deck service over its loopback API,
// the same one the MCP server uses. Revisions, request ids and live-run
// tokens are handled here, so the agent never has to carry them.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readConnection, type LocalConnection } from "@/lib/deck-service/connection";

export interface Issue { path: string; message: string }

export class CliError extends Error {
  constructor(
    public code: string,
    message: string,
    public issues: Issue[] = [],
    public exitCode = 1,
  ) { super(message); }
}

export interface SlideSummary { id: string; layout: string | null; manuallyEdited: boolean }
export interface AgentWorkSummary { id: string; status: string; plannedSlides?: number; summary?: string }
export interface SlideSource { spec: { layout: string; theme?: string; content?: Record<string, unknown> }; stale: boolean }
export interface SlideDetail { id: string; themeId?: string; source: SlideSource | null; texts: { id: string; text: string }[] }

export interface DeckSummary {
  deckId: string;
  revision: number;
  title: string;
  slides: SlideSummary[];
  warnings: Issue[];
  agentWork?: AgentWorkSummary;
  editorUrl: string;
  ownerToken?: string;
}
export interface DeckDetail extends Omit<DeckSummary, "slides"> {
  defaults: { theme?: string; footer?: { left?: string; note?: string } };
  slides: SlideDetail[];
}

const SERVICE_DOWN = "The deck service is not running. Open the WKND Deck app, or run `npm run deck-service` in the project, then try again.";
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/;

export function newRequestId() { return `cli-${randomUUID()}`; }

export function assertId(value: string, what: string) {
  if (!ID.test(value)) throw new CliError("INVALID_ID", `"${value}" is not a valid ${what} id.`, [], 2);
  return value;
}

export class DeckApi {
  private connection?: Promise<LocalConnection>;
  constructor(readonly dataDir: string) {}

  connect() {
    this.connection ??= readConnection(this.dataDir).catch(() => { throw new CliError("SERVICE_UNAVAILABLE", SERVICE_DOWN, [], 3); });
    return this.connection;
  }

  async call<T = Record<string, unknown>>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
    const connection = await this.connect();
    let response: Response;
    try {
      response = await fetch(`${connection.url}/tools/${tool}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${connection.token}` },
        body: JSON.stringify(args),
        redirect: "error",
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new CliError("SERVICE_UNAVAILABLE", SERVICE_DOWN, [], 3);
    }
    const result = await response.json().catch(() => null) as { ok?: boolean; error?: { code?: string; message?: string; issues?: Issue[] } } | null;
    if (!response.ok || !result || result.ok === false) {
      const error = result?.error ?? {};
      throw new CliError(error.code ?? "SERVICE_ERROR", error.message ?? `The deck service answered with status ${response.status}.`, error.issues ?? []);
    }
    return result as T;
  }
}

// Owner tokens of live runs this CLI started, so later commands can continue
// the run. Stored next to the decks, readable only by the user.
export interface StoredRun { runId: string; ownerToken: string; plannedSlides?: number }

export class RunStore {
  constructor(private dataDir: string) {}
  private file(deckId: string) { return join(this.dataDir, "agent-runs", `${assertId(deckId, "deck")}.json`); }

  async get(deckId: string): Promise<StoredRun | undefined> {
    try {
      const value = JSON.parse(await readFile(this.file(deckId), "utf8"));
      return typeof value?.runId === "string" && typeof value?.ownerToken === "string" ? value : undefined;
    } catch { return undefined; }
  }

  async set(deckId: string, run: StoredRun) {
    const file = this.file(deckId);
    await mkdir(join(this.dataDir, "agent-runs"), { recursive: true, mode: 0o700 });
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(run), { mode: 0o600 });
    await rename(temporary, file);
  }

  async delete(deckId: string) { await rm(this.file(deckId), { force: true }); }
}
