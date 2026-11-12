import { z } from "zod";

export const workStatusSchema = z.enum(["working", "completed", "partial", "failed", "interrupted"]);
export const agentWorkSchema = z.object({
  id: z.string(),
  status: workStatusSchema,
  plannedSlides: z.number().int().min(1).max(60).optional(),
  updatedAt: z.iso.datetime(),
  summary: z.string().max(240).optional(),
  lastSlideId: z.string().optional(),
  ownerHash: z.string().regex(/^[a-f0-9]{64}$/),
  serviceInstance: z.string().uuid(),
}).strict();
export type AgentWork = z.infer<typeof agentWorkSchema>;
export type PublicAgentWork = Omit<AgentWork, "ownerHash" | "serviceInstance">;
export const WORK_IDLE_MS = 10 * 60_000;
