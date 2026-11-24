import { z } from "zod";
import { THEME_IDS } from "@/lib/themes/deck-themes";
import { agentWorkSchema } from "./work-types";

export const idSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/);
export const requestIdSchema = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/);
export const revisionSchema = z.number().int().positive();
export const contentSchema = z.record(z.string(), z.unknown());
export const slideSpecSchema = z.object({
  layout: z.string().min(1),
  theme: z.enum(THEME_IDS).optional(),
  content: contentSchema.optional(),
}).strict();
export const deckSpecSchema = z.object({
  version: z.literal(1).optional(),
  title: z.string().optional(),
  theme: z.enum(THEME_IDS).optional(),
  footer: z.object({ left: z.string().optional(), note: z.string().optional() }).strict().optional(),
  slides: z.array(slideSpecSchema).min(1).max(60),
}).strict();
export const mutationSchema = z.object({
  deckId: idSchema,
  expectedRevision: revisionSchema,
  requestId: requestIdSchema,
  runId: idSchema.optional(),
  ownerToken: z.string().min(16).max(128).optional(),
});
export const createSchema = z.object({ spec: deckSpecSchema, requestId: requestIdSchema, live: z.boolean().optional(), plannedSlides: z.number().int().min(1).max(60).optional() }).strict();
export const addSchema = mutationSchema.extend({
  slideSpec: slideSpecSchema,
  afterSlideId: idSchema.optional(),
}).strict();
export const updateSchema = mutationSchema.extend({
  slideId: idSchema,
  contentPatch: contentSchema.optional(),
  slideSpec: slideSpecSchema.optional(),
  replaceManual: z.boolean().optional(),
}).strict().refine(value => (value.contentPatch !== undefined) !== (value.slideSpec !== undefined), {
  message: "Provide exactly one of contentPatch or slideSpec.",
});
export const saveSchema = mutationSchema.extend({ presentation: z.unknown() }).strict();
export const slideTargetSchema = mutationSchema.extend({ slideId: idSchema }).strict();
// Without afterSlideId the slide moves to the start of the deck.
export const moveSlideSchema = mutationSchema.extend({ slideId: idSchema, afterSlideId: idSchema.optional() }).strict();
export const deckSettingsSchema = mutationSchema.extend({
  title: z.string().trim().min(1).max(200).optional(),
  // "none" removes the deck theme, so every layout keeps its own colors.
  theme: z.union([z.enum(THEME_IDS), z.literal("none")]).optional(),
  footer: z.object({ left: z.string().max(200).optional(), note: z.string().max(200).optional() }).strict().optional(),
}).strict().refine(value => value.title !== undefined || value.theme !== undefined || value.footer !== undefined, {
  message: "Provide a title, theme or footer.",
});
export const layoutUsageSchema = z.object({ decks: z.number().int().min(1).max(50).optional() }).strict();
export const startWorkSchema = z.object({ deckId: idSchema, expectedRevision: revisionSchema, requestId: requestIdSchema, plannedSlides: z.number().int().min(1).max(60).optional() }).strict();
export const finishWorkSchema = mutationSchema.extend({ status: z.enum(["completed", "partial", "failed"]), summary: z.string().max(240).optional() }).strict();
export const deleteSchema = z.object({ deckId: idSchema, expectedRevision: revisionSchema }).strict();
export const deletedDocumentSchema = z.object({
  storageVersion: z.literal(1), deleted: z.literal(true), deckId: idSchema,
  revision: revisionSchema, deletedAt: z.iso.datetime(),
}).strict();

export const documentSchema = z.object({
  storageVersion: z.literal(1),
  revision: revisionSchema,
  updatedAt: z.iso.datetime(),
  createdAt: z.iso.datetime().optional(),
  agentWork: agentWorkSchema.optional(),
  presentation: z.unknown(),
  defaults: deckSpecSchema.pick({ theme: true, footer: true }),
  sources: z.record(z.string(), z.object({ spec: slideSpecSchema, builtHash: z.string().regex(/^[a-f0-9]{64}$/), stale: z.boolean() }).strict()),
  warnings: z.array(z.object({ path: z.string(), message: z.string() }).strict()),
  validation: z.literal("estimated"),
  receipts: z.record(z.string(), z.object({ fingerprint: z.string().regex(/^[a-f0-9]{64}$/), revision: revisionSchema }).strict()),
}).strict();
