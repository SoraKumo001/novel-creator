import { foreshadowingStatusSchema } from "@novel-creator/shared/schemas";
import { z } from "zod";

export const createForeshadowingSchema = z.object({
  category: z.string().optional(),
  description: z.string().optional(),
  placedSectionId: z.string().uuid().optional().nullable(),
  resolvedSectionId: z.string().uuid().optional().nullable(),
  status: foreshadowingStatusSchema.optional(),
  title: z.string().min(1),
});

export const updateForeshadowingSchema = z.object({
  category: z.string().optional(),
  description: z.string().optional().nullable(),
  placedSectionId: z.string().uuid().optional().nullable(),
  resolvedSectionId: z.string().uuid().optional().nullable(),
  status: foreshadowingStatusSchema.optional(),
  title: z.string().min(1).optional(),
});

export const foreshadowingDraftSchema = z.object({
  currentDraft: z
    .object({
      category: z.string().optional(),
      description: z.string().optional(),
      status: foreshadowingStatusSchema.optional(),
      title: z.string(),
    })
    .optional(),
  instruction: z.string().min(1),
});

export const saveForeshadowingsMarkdownSchema = z.object({
  markdown: z.string().min(1),
});

export const editForeshadowingSectionSchema = z.object({
  category: z.string().min(1),
  description: z.string(),
  instruction: z.string().min(1),
  status: foreshadowingStatusSchema.optional(),
  title: z.string().min(1),
});

export const editForeshadowingDocumentSchema = z.object({
  instruction: z.string().min(1),
  markdown: z.string().min(1),
});
