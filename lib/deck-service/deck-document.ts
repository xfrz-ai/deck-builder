import type { DeckSlideSpec, DeckSpec, DeckSpecIssue } from "@/lib/deck-spec/deck-spec";
import type { Presentation } from "@/types/presentation";
import type { AgentWork, PublicAgentWork } from "./work-types";

export interface SlideSource {
  spec: DeckSlideSpec;
  builtHash: string;
  stale: boolean;
}

export interface DeckDocument {
  storageVersion: 1;
  revision: number;
  updatedAt: string;
  createdAt?: string;
  agentWork?: AgentWork;
  presentation: Presentation;
  defaults: Pick<DeckSpec, "theme" | "footer">;
  sources: Record<string, SlideSource>;
  warnings: DeckSpecIssue[];
  validation: "estimated";
  // Persistent receipts allow retries after a response is lost or the service restarts.
  receipts: Record<string, { fingerprint: string; revision: number }>;
}

export type DeckSnapshot = Omit<DeckDocument, "receipts" | "agentWork"> & { agentWork?: PublicAgentWork };

export class DeckError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public issues: DeckSpecIssue[] = [],
    public currentRevision?: number,
  ) { super(message); }
}

export function errorResult(error: unknown) {
  if (error instanceof DeckError) {
    return { ok: false, error: { code: error.code, message: error.message, issues: error.issues, currentRevision: error.currentRevision } };
  }
  return { ok: false, error: { code: "INTERNAL_ERROR", message: "The local deck operation failed. Check the service terminal." } };
}

export function snapshot(document: DeckDocument): DeckSnapshot {
  const { receipts: _receipts, agentWork, ...result } = document;
  void _receipts;
  const publicWork = agentWork ? Object.fromEntries(Object.entries(agentWork).filter(([key]) => key !== "ownerHash" && key !== "serviceInstance")) : undefined;
  // Public snapshots have exactly the same JSON shape before and after a restart.
  return JSON.parse(JSON.stringify({ ...result, ...(publicWork ? { agentWork: publicWork } : {}) })) as DeckSnapshot;
}
