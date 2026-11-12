import { z } from "zod";

export const deckEventSchema = z.object({
  type: z.enum(["connection.sync", "operation.started", "document.committed", "document.deleted", "operation.failed"]),
  id: z.string().max(120),
  instance: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  deckId: z.string(),
  revision: z.number().int().positive(),
  source: z.enum(["agent", "editor", "service"]),
  operation: z.enum(["create", "add", "update", "save", "start", "finish", "delete"]).optional(),
  requestId: z.string().optional(),
  changedSlideIds: z.array(z.string()).default([]),
  errorCode: z.string().optional(),
  reset: z.boolean().optional(),
});
export type DeckEvent = z.infer<typeof deckEventSchema>;
export type EventInput = Omit<DeckEvent, "id" | "instance" | "sequence">;
