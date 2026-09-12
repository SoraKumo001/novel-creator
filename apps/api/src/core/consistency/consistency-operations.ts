import {
  chapters,
  consistencyReports,
  novels,
  sections,
} from "@novel-creator/db";
import { and, desc, eq } from "drizzle-orm";
import { runWithHeartbeat } from "../analysis/analysis-heartbeat.js";
import type { AnalysisStreamEvent } from "../analysis/analysis-types.js";
import { validateSectionGlossaryOp } from "../generate/validate-operations.js";
import type { ServiceContext } from "../types.js";
import { assertFound } from "../types.js";

/**
 * 節単位の用語集整合性チェック (SSE 用)。
 * validateSectionGlossaryOp を heartbeat で包み、progress → reports insert → complete の順で流す。
 */
export async function* streamCheckGlossaryOp(
  ctx: ServiceContext,
  novelId: string,
  sectionId: string
): AsyncGenerator<AnalysisStreamEvent, void, undefined> {
  const [novel] = await ctx.db
    .select()
    .from(novels)
    .where(eq(novels.id, novelId));
  assertFound(novel, "Novel not found");

  const [section] = await ctx.db
    .select()
    .from(sections)
    .where(eq(sections.id, sectionId));
  assertFound(section, "Section not found");
  const [chapter] = await ctx.db
    .select()
    .from(chapters)
    .where(eq(chapters.id, section.chapterId));
  assertFound(chapter, "Chapter not found");
  if (chapter.novelId !== novelId) {
    throw new Error("Section does not belong to novel");
  }

  yield {
    current: 1,
    stage: "用語集との整合性を検証中",
    total: 2,
    type: "progress",
  };

  const validation = yield* runWithHeartbeat(
    validateSectionGlossaryOp(ctx, sectionId)
  );

  yield { current: 0, stage: "検証結果を保存中", total: 0, type: "progress" };
  const [row] = await ctx.db
    .insert(consistencyReports)
    .values({
      novelId,
      ok: validation.ok,
      targetSectionId: sectionId,
      violations: validation.violations,
    })
    .returning();

  yield { result: validation, savedId: row.id, type: "complete" };
}

export async function listConsistencyReportsOp(
  ctx: ServiceContext,
  novelId: string
) {
  const rows = await ctx.db
    .select()
    .from(consistencyReports)
    .where(eq(consistencyReports.novelId, novelId))
    .orderBy(desc(consistencyReports.createdAt))
    .limit(50);

  return rows.map((row) => ({
    createdAt: row.createdAt?.toISOString() ?? null,
    id: row.id,
    novelId: row.novelId,
    ok: row.ok,
    targetSectionId: row.targetSectionId,
    violations: row.violations,
  }));
}

export async function deleteConsistencyReportOp(
  ctx: ServiceContext,
  novelId: string,
  reportId: string
) {
  await ctx.db
    .delete(consistencyReports)
    .where(
      and(
        eq(consistencyReports.id, reportId),
        eq(consistencyReports.novelId, novelId)
      )
    );
}
