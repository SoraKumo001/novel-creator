import { z } from "zod";

export const createTimelineSchema = z.object({
  event: z.string().min(1),
  order: z.number().int().optional(),
  sectionId: z.string().optional(),
  timestamp: z.string().optional(),
});

export const updateTimelineSchema = z.object({
  event: z.string().min(1).optional(),
  order: z.number().int().optional(),
  sectionId: z.string().optional().nullable(),
  timestamp: z.string().optional().nullable(),
});

// ---- 年表マークダウン一括保存 ----
export const saveTimelinesMarkdownSchema = z.object({
  markdown: z.string(),
});
