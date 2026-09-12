import { chapters, contents, novels, sections } from "@novel-creator/db";
import {
  chapterSummary,
  contentGeneration,
  extractSettings,
  extractTimeline,
  generateJSON,
  plotGeneration,
  sectionSummary,
  streamText,
  truncateHead,
} from "@novel-creator/llm";
import { and, asc, desc, eq, lt } from "drizzle-orm";
import { searchContext } from "../../rag.js";
import {
  buildOpenCodeSessionHeaders,
  resolveLLMModelWithInfo,
} from "../model-resolver.js";
import { assertFound, type ServiceContext } from "../types.js";

/**
 * Phase1: 直前文脈用の末尾優先切り詰め。接続部（末尾）を残す。
 */
function truncateTail(text: string, limit: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return trimmed.slice(-limit);
}

export async function generatePlotOp(
  ctx: ServiceContext,
  novelId: string,
  modelConfigId?: string | null
) {
  const [novel] = await ctx.db
    .select()
    .from(novels)
    .where(eq(novels.id, novelId));
  assertFound(novel, "Novel not found");

  const context = await searchContext(
    ctx.vectorStore,
    ctx.embedding,
    novelId,
    { query: `${novel.title} ${novel.description ?? ""}` },
    ctx.env
  );

  const prompt = plotGeneration({
    characters: context.characters,
    description: novel.description ?? "",
    settings: context.settings,
    title: novel.title,
  });

  const resolved = await resolveLLMModelWithInfo(ctx, modelConfigId, "throw");
  const headers = buildOpenCodeSessionHeaders(
    resolved,
    novelId,
    ctx.env.LLM_BASE_URL
  );
  return generateJSON<{
    title: string;
    description: string;
    chapters: { title: string; order: number; summary: string }[];
  }>(resolved.model, prompt, undefined, {
    ...(headers ? { headers } : {}),
  });
}

export async function generateChapterSummaryOp(
  ctx: ServiceContext,
  chapterId: string
) {
  const [chapter] = await ctx.db
    .select()
    .from(chapters)
    .where(eq(chapters.id, chapterId));
  assertFound(chapter, "Chapter not found");
  const [novel] = await ctx.db
    .select()
    .from(novels)
    .where(eq(novels.id, chapter.novelId));
  assertFound(novel, "Novel not found");

  const chapterSections = await ctx.db
    .select()
    .from(sections)
    .where(eq(sections.chapterId, chapterId))
    .orderBy(asc(sections.order));
  const sectionSummaries = chapterSections
    .map((s) => s.summary?.trim() ?? "")
    .filter((s) => s.length > 0);

  const prompt = chapterSummary(
    { description: novel.description ?? "", title: novel.title },
    {
      order: chapter.order,
      summary: chapter.summary ?? undefined,
      title: chapter.title,
    },
    { sectionSummaries }
  );

  const result = await generateJSON<{
    title: string;
    order: number;
    summary: string;
  }>(ctx.llm, prompt);

  await ctx.db
    .update(chapters)
    .set({ summary: result.summary, updatedAt: new Date() })
    .where(eq(chapters.id, chapterId));

  return result;
}

export async function generateSectionSummaryOp(
  ctx: ServiceContext,
  sectionId: string
) {
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

  const [content] = await ctx.db
    .select()
    .from(contents)
    .where(eq(contents.sectionId, sectionId));
  const bodyExcerpt = content?.body?.trim()
    ? truncateHead(content.body, 6000)
    : undefined;

  const siblings = await ctx.db
    .select()
    .from(sections)
    .where(eq(sections.chapterId, section.chapterId))
    .orderBy(asc(sections.order));
  const previousSummaries = siblings
    .filter((s) => s.order < section.order && s.summary?.trim())
    .slice(-2)
    .map((s) => (s.summary as string).trim());

  const prompt = sectionSummary(
    { summary: chapter.summary ?? "", title: chapter.title },
    { order: section.order, title: section.title ?? undefined },
    { bodyExcerpt, previousSummaries }
  );

  const result = await generateJSON<{
    title: string;
    order: number;
    summary: string;
  }>(ctx.llm, prompt);

  await ctx.db
    .update(sections)
    .set({ summary: result.summary, updatedAt: new Date() })
    .where(eq(sections.id, sectionId));

  return result;
}

export async function* generateSectionContentOp(
  ctx: ServiceContext,
  sectionId: string,
  modelConfigId?: string | null
): AsyncGenerator<string> {
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

  const previousSections = await ctx.db
    .select()
    .from(sections)
    .where(eq(sections.chapterId, section.chapterId))
    .orderBy(sections.order);
  const prevIndex = previousSections.findIndex((s) => s.id === sectionId);
  let previousContent: string | undefined;
  if (prevIndex > 0) {
    // 直前 N=2 件を同一章内から取得（末尾優先・各2000字上限で切り詰め）
    const targetSections = previousSections.slice(
      Math.max(0, prevIndex - 2),
      prevIndex
    );
    const bodies: string[] = [];
    for (const target of targetSections) {
      const [prevContent] = await ctx.db
        .select()
        .from(contents)
        .where(eq(contents.sectionId, target.id));
      if (prevContent?.body?.trim()) {
        bodies.push(truncateTail(prevContent.body, 2000));
      }
    }
    previousContent = bodies.length > 0 ? bodies.join("\n\n") : undefined;
  } else {
    // 章の第1節の場合、前章の最終節本文を取得して章またぎの文脈断絶を防ぐ
    const previousChapters = await ctx.db
      .select()
      .from(chapters)
      .where(
        and(
          eq(chapters.novelId, chapter.novelId),
          lt(chapters.order, chapter.order)
        )
      )
      .orderBy(desc(chapters.order))
      .limit(1);
    const prevChapter = previousChapters[0];
    if (prevChapter) {
      const prevChapterSections = await ctx.db
        .select()
        .from(sections)
        .where(eq(sections.chapterId, prevChapter.id))
        .orderBy(desc(sections.order))
        .limit(1);
      const lastSection = prevChapterSections[0];
      if (lastSection) {
        const [prevContent] = await ctx.db
          .select()
          .from(contents)
          .where(eq(contents.sectionId, lastSection.id));
        previousContent = prevContent?.body?.trim()
          ? truncateTail(prevContent.body, 2000)
          : undefined;
      }
    }
  }

  const ragContext = await searchContext(
    ctx.vectorStore,
    ctx.embedding,
    chapter.novelId,
    {
      contentMinScore: 0.3,
      contentTopK: 3,
      foreshadowingTopK: 3,
      minScore: 0.25,
      previousContent,
      query: `${section.title ?? ""} ${section.summary ?? ""}`,
      topK: 5,
    },
    ctx.env
  );

  const [novel] = await ctx.db
    .select()
    .from(novels)
    .where(eq(novels.id, chapter.novelId));

  const prompt = contentGeneration(
    { summary: section.summary ?? "", title: section.title ?? undefined },
    {
      chapter: {
        summary: chapter.summary,
        title: chapter.title,
      },
      characters: ragContext.characters,
      contents: ragContext.contents,
      foreshadowings: ragContext.foreshadowings,
      glossaries: ragContext.glossaries,
      previousContent: ragContext.previousContent,
      settings: ragContext.settings,
      styleGuide: novel?.styleGuide,
    }
  );

  const resolved = await resolveLLMModelWithInfo(ctx, modelConfigId, "throw");
  const headers = buildOpenCodeSessionHeaders(
    resolved,
    sectionId,
    ctx.env.LLM_BASE_URL
  );
  for await (const chunk of streamText(resolved.model, prompt, {
    ...(headers ? { headers } : {}),
  })) {
    yield chunk;
  }
}

export async function extractSectionEntitiesOp(
  ctx: ServiceContext,
  sectionId: string
) {
  const [section] = await ctx.db
    .select()
    .from(sections)
    .where(eq(sections.id, sectionId));
  assertFound(section, "Section not found");
  const [content] = await ctx.db
    .select()
    .from(contents)
    .where(eq(contents.sectionId, sectionId));
  if (!content?.body.trim()) {
    return { characters: [], settings: [], timelines: [] };
  }

  const body = content.body;

  const [settingResult, timelineResult] = await Promise.all([
    generateJSON<{ name: string; category: string; description: string }[]>(
      ctx.llm,
      extractSettings(body, [])
    ).catch(() => []),
    generateJSON<{ time?: string; event: string; order: number }[]>(
      ctx.llm,
      extractTimeline(body)
    ).catch(() => []),
  ]);

  return {
    characters: [],
    settings: (settingResult ?? []).map((s) => ({
      category: s.category,
      description: s.description,
      name: s.name,
    })),
    timelines: (timelineResult ?? []).map((t) => ({
      event: t.event,
      order: t.order,
      timestamp: t.time ?? "",
    })),
  };
}
