import { z } from "zod";

// ---- chapters ----
export const createChapterSchema = z.object({
  order: z.number().int().optional(),
  summary: z.string().optional(),
  title: z.string().min(1),
});

export const updateChapterSchema = z.object({
  order: z.number().int().optional(),
  summary: z.string().optional(),
  title: z.string().min(1).optional(),
});

// ---- sections ----
export const createSectionSchema = z.object({
  order: z.number().int().optional(),
  summary: z.string().optional(),
  title: z.string().optional(),
});

export const updateSectionSchema = z.object({
  order: z.number().int().optional(),
  summary: z.string().optional(),
  title: z.string().optional(),
});

// ---- contents ----
export const updateContentSchema = z.object({
  body: z.string(),
  // 楽観ロック用。未指定時は従来どおり上書きする。
  updatedAt: z.string().optional(),
});
