import { analysisResults } from "@novel-creator/db";
import { and, desc, eq } from "drizzle-orm";
import type { ServiceContext } from "../types.js";

export async function listResultsOp(
  ctx: ServiceContext,
  novelId: string,
  analysisType?: "story-arc" | "check-voice" | "persona-review"
) {
  const conditions = [eq(analysisResults.novelId, novelId)];
  if (analysisType) {
    conditions.push(eq(analysisResults.analysisType, analysisType));
  }

  const rows = await ctx.db
    .select()
    .from(analysisResults)
    .where(and(...conditions))
    .orderBy(desc(analysisResults.createdAt))
    .limit(50);

  return rows.map((row) => ({
    analysisType: row.analysisType,
    createdAt: row.createdAt?.toISOString() ?? null,
    id: row.id,
    novelId: row.novelId,
    result: row.result,
    targetChapterId: row.targetChapterId,
    targetSectionId: row.targetSectionId,
  }));
}

export async function deleteResultOp(
  ctx: ServiceContext,
  novelId: string,
  resultId: string
) {
  await ctx.db
    .delete(analysisResults)
    .where(
      and(
        eq(analysisResults.id, resultId),
        eq(analysisResults.novelId, novelId)
      )
    );
}
