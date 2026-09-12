import { z } from "zod";

export const createGlossarySchema = z.object({
  aliases: z.array(z.string()).optional(),
  category: z.string().min(1).optional(),
  description: z.string().optional(),
  reading: z.string().optional(),
  term: z.string().min(1),
});

export const updateGlossarySchema = z.object({
  aliases: z.array(z.string()).optional(),
  category: z.string().min(1).optional(),
  description: z.string().optional(),
  reading: z.string().optional(),
  term: z.string().min(1).optional(),
});

export const glossaryIdParamSchema = z.object({
  entryId: z.uuid(),
});
