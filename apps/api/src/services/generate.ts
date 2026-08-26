import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import { eq } from 'drizzle-orm';
import { chapters, contents, novels, sections } from '@novel-creator/db';
import {
  chapterSummary,
  contentGeneration,
  extractSettings,
  extractTimeline,
  generateJSON,
  plotGeneration,
  sectionSummary,
  streamText,
} from '@novel-creator/llm';
import { GenerateService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';
import { searchContext } from '../rag.js';

export function registerGenerateService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(GenerateService, {
    async generatePlot(req) {
      const ctx = getContext();
      const db = ctx.db;
      const [novel] = await db.select().from(novels).where(eq(novels.id, req.novelId));
      if (!novel) {
        throw new ConnectError('Novel not found', Code.NotFound);
      }

      const context = await searchContext(
        ctx.vectorStore,
        ctx.embedding,
        req.novelId,
        {
          query: `${novel.title} ${novel.description ?? ''}`,
        },
        ctx.env,
      );

      const prompt = plotGeneration({
        title: novel.title,
        description: novel.description ?? '',
        settings: context.settings,
        characters: context.characters,
      });

      const result = await generateJSON<{
        title: string;
        description: string;
        chapters: { title: string; order: number; summary: string }[];
      }>(ctx.llm, prompt);

      return {
        title: result.title,
        description: result.description,
        chapters: result.chapters.map((ch) => ({
          title: ch.title,
          order: ch.order,
          summary: ch.summary,
        })),
      };
    },

    async generateChapterSummary(req) {
      const ctx = getContext();
      const db = ctx.db;
      const [chapter] = await db.select().from(chapters).where(eq(chapters.id, req.chapterId));
      if (!chapter) {
        throw new ConnectError('Chapter not found', Code.NotFound);
      }
      const [novel] = await db.select().from(novels).where(eq(novels.id, chapter.novelId));
      if (!novel) {
        throw new ConnectError('Novel not found', Code.NotFound);
      }

      const prompt = chapterSummary(
        { title: novel.title, description: novel.description ?? '' },
        { title: chapter.title, order: chapter.order, summary: chapter.summary ?? undefined },
      );

      const result = await generateJSON<{ title: string; order: number; summary: string }>(
        ctx.llm,
        prompt,
      );

      return {
        title: result.title,
        order: result.order,
        summary: result.summary,
      };
    },

    async generateSectionSummary(req) {
      const ctx = getContext();
      const db = ctx.db;
      const [section] = await db.select().from(sections).where(eq(sections.id, req.sectionId));
      if (!section) {
        throw new ConnectError('Section not found', Code.NotFound);
      }
      const [chapter] = await db.select().from(chapters).where(eq(chapters.id, section.chapterId));
      if (!chapter) {
        throw new ConnectError('Chapter not found', Code.NotFound);
      }

      const prompt = sectionSummary(
        { title: chapter.title, summary: chapter.summary ?? '' },
        { title: section.title ?? undefined, order: section.order },
      );

      const result = await generateJSON<{ title: string; order: number; summary: string }>(
        ctx.llm,
        prompt,
      );

      return {
        title: result.title,
        order: result.order,
        summary: result.summary,
      };
    },

    async *generateSectionContent(req) {
      const ctx = getContext();
      const db = ctx.db;
      const [section] = await db.select().from(sections).where(eq(sections.id, req.sectionId));
      if (!section) {
        throw new ConnectError('Section not found', Code.NotFound);
      }
      const [chapter] = await db.select().from(chapters).where(eq(chapters.id, section.chapterId));
      if (!chapter) {
        throw new ConnectError('Chapter not found', Code.NotFound);
      }

      const previousSections = await db
        .select()
        .from(sections)
        .where(eq(sections.chapterId, section.chapterId))
        .orderBy(sections.order);
      const prevIndex = previousSections.findIndex((s) => s.id === req.sectionId);
      let previousContent: string | undefined;
      if (prevIndex > 0) {
        const prevSection = previousSections[prevIndex - 1];
        const [prevContent] = await db
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
          query: `${section.title ?? ''} ${section.summary ?? ''}`,
          previousContent,
        },
        ctx.env,
      );

      const prompt = contentGeneration(
        { title: section.title ?? undefined, summary: section.summary ?? '' },
        {
          previousContent: ragContext.previousContent,
          characters: ragContext.characters,
          settings: ragContext.settings,
        },
      );

      for await (const chunk of streamText(ctx.llm, prompt)) {
        yield { chunk };
      }
    },

    async extractEntities(req) {
      const ctx = getContext();
      const db = ctx.db;
      const [section] = await db.select().from(sections).where(eq(sections.id, req.sectionId));
      if (!section) {
        throw new ConnectError('Section not found', Code.NotFound);
      }
      const [content] = await db
        .select()
        .from(contents)
        .where(eq(contents.sectionId, req.sectionId));
      if (!content || !content.body.trim()) {
        return { characters: [], settings: [], timelines: [] };
      }

      const body = content.body;

      const [settingResult, timelineResult] = await Promise.all([
        generateJSON<{ name: string; category: string; description: string }[]>(
          ctx.llm,
          extractSettings(body, []),
        ).catch(() => []),
        generateJSON<{ time?: string; event: string; order: number }[]>(
          ctx.llm,
          extractTimeline(body),
        ).catch(() => []),
      ]);

      return {
        characters: [],
        settings: (settingResult ?? []).map((s) => ({
          name: s.name,
          category: s.category,
          description: s.description,
        })),
        timelines: (timelineResult ?? []).map((t) => ({
          event: t.event,
          timestamp: t.time ?? '',
          order: t.order,
        })),
      };
    },
  });
}
