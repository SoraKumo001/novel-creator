import { z } from "zod";

export const promptCategorySchema = z.enum([
  "inline",
  "generation",
  "chat",
  "general",
]);

export const listCustomPromptsQuerySchema = z.object({
  category: promptCategorySchema.optional(),
  novelId: z.string().uuid().optional().nullable(),
});

export const createCustomPromptSchema = z.object({
  category: promptCategorySchema.optional().default("inline"),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  name: z.string().min(1),
  novelId: z.string().uuid().optional().nullable(),
  order: z.number().int().optional().default(0),
  systemPrompt: z.string().optional().nullable(),
  userPrompt: z.string().min(1),
});

export const updateCustomPromptSchema = z.object({
  category: promptCategorySchema.optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  order: z.number().int().optional(),
  systemPrompt: z.string().nullable().optional(),
  userPrompt: z.string().min(1).optional(),
});
