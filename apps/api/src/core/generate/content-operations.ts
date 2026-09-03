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
} from "@novel-creator/llm";
import { eq } from "drizzle-orm";
import { searchContext } from "../../rag.js";
import { resolveLLMModel } from "../model-resolver.js";
import { assertFound, type ServiceContext } from "../types.js";

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

  const llm = await resolveLLMModel(ctx, modelConfigId, "throw");
  return generateJSON<{
    title: string;
    description: string;
    chapters: { title: string; order: number; summary: string }[];
  }>(llm, prompt);
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

  const prompt = chapterSummary(
    { description: novel.description ?? "", title: novel.title },
    {
      order: chapter.order,
      summary: chapter.summary ?? undefined,
      title: chapter.title,
    }
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

  const prompt = sectionSummary(
    { summary: chapter.summary ?? "", title: chapter.title },
    { order: section.order, title: section.title ?? undefined }
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
    const prevSection = previousSections[prevIndex - 1];
    const [prevContent] = await ctx.db
      .select()
      .from(contents)
      .where(eq(contents.sectionId, prevSection.id));
    previousContent = prevContent?.body;
  }

  const ragContext = await searchContext(
    ctx.vectorStore,
    ctx.embedding,
    chapter.novelId,
    {
      previousContent,
      query: `${section.title ?? ""} ${section.summary ?? ""}`,
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
      characters: ragContext.characters,
      previousContent: ragContext.previousContent,
      settings: ragContext.settings,
      styleGuide: novel?.styleGuide,
    }
  );

  const llm = await resolveLLMModel(ctx, modelConfigId, "throw");
  for await (const chunk of streamText(llm, prompt)) {
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
