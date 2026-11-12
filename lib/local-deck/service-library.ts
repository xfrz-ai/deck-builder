import { z } from "zod";
import type { DeckSummary } from "@/lib/presentation/library";
import { agentWorkSchema, WORK_IDLE_MS, type PublicAgentWork } from "@/lib/deck-service/work-types";

export const serviceSummarySchema = z.object({
  id: z.string(), title: z.string(), slideCount: z.number().int().min(1).max(60),
  createdAt: z.number(), updatedAt: z.number(), revision: z.number().int().positive(),
  agentWork: agentWorkSchema.omit({ ownerHash: true, serviceInstance: true }).optional(),
});
export type ServiceDeckSummary = DeckSummary & { source: "service"; revision: number; agentWork?: PublicAgentWork };
export function workLabel(work?: PublicAgentWork, now = Date.now()) {
  const status = work?.status === "working" && now - Date.parse(work.updatedAt) > WORK_IDLE_MS ? "interrupted" : work?.status;
  switch (status) {
    case "working": return "AI sedang mengerjakan";
    case "completed": return "Selesai";
    case "partial": return "Selesai sebagian";
    case "failed": return "Gagal";
    case "interrupted": return "Terhenti - dapat dilanjutkan";
    default: return "Deck lokal";
  }
}
