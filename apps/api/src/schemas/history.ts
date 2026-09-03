import { z } from "zod";

// ---- 履歴 ----
export const listHistoriesQuerySchema = z.object({
  entityId: z.string().uuid().optional(),
  entityType: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  novelId: z.string().uuid(),
});

// ---- AI 分析結果 ----
export const analysisTypeSchema = z.enum([
  "story-arc",
  "check-voice",
  "persona-review",
]);

export const listAnalysisResultsQuerySchema = z.object({
  analysisType: analysisTypeSchema.optional(),
});

export const analysisResultParamsSchema = z.object({
  id: z.uuid(),
  resultId: z.uuid(),
});
