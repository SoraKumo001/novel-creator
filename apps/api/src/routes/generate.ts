import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import type { StreamingApi } from 'hono/utils/stream';
import { zValidator } from '@hono/zod-validator';

import { chapters, contents, novels, sections, settings, timelines } from '@novel-creator/db';
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

import type { AppContext } from '../context.js';
import { searchContext, upsertEntityEmbedding } from '../rag.js';
import { idParamSchema, novelIdParamSchema } from '../schemas/index.js';

const generateRouter = new Hono<AppContext>();

// POST /api/novels/:novelId/generate/plot - プロット生成
generateRouter.post(
  '/novels/:novelId/generate/plot',
  zValidator('param', novelIdParamSchema),
  async (c) => {
    const db = c.var.db;
    const { novelId } = c.req.valid('param');
    const [novel] = await db.select().from(novels).where(eq(novels.id, novelId));
    if (!novel) return c.json({ error: 'Novel not found' }, 404);

    const context = await searchContext(
      c.var.vectorStore,
      c.var.embedding,
      novelId,
      {
        query: `${novel.title} ${novel.description ?? ''}`,
      },
      c.var.env,
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
    }>(c.var.llm, prompt);

    return c.json(result);
  },
);

// POST /api/chapters/:id/generate/summary - 章の概要生成
generateRouter.post(
  '/chapters/:id/generate/summary',
  zValidator('param', idParamSchema),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id));
    if (!chapter) return c.json({ error: 'Chapter not found' }, 404);
    const [novel] = await db.select().from(novels).where(eq(novels.id, chapter.novelId));
    if (!novel) return c.json({ error: 'Novel not found' }, 404);

    const prompt = chapterSummary(
      { title: novel.title, description: novel.description ?? '' },
      { title: chapter.title, order: chapter.order, summary: chapter.summary ?? undefined },
    );

    const result = await generateJSON<{ title: string; order: number; summary: string }>(
      c.var.llm,
      prompt,
    );

    return c.json(result);
  },
);

// POST /api/sections/:id/generate/summary - 節の概要生成
generateRouter.post(
  '/sections/:id/generate/summary',
  zValidator('param', idParamSchema),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const [section] = await db.select().from(sections).where(eq(sections.id, id));
    if (!section) return c.json({ error: 'Section not found' }, 404);
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, section.chapterId));
    if (!chapter) return c.json({ error: 'Chapter not found' }, 404);

    const prompt = sectionSummary(
      { title: chapter.title, summary: chapter.summary ?? '' },
      { title: section.title ?? undefined, order: section.order },
    );

    const result = await generateJSON<{ title: string; order: number; summary: string }>(
      c.var.llm,
      prompt,
    );

    return c.json(result);
  },
);

// POST /api/sections/:id/generate/content - 本文生成（ストリーミング）
generateRouter.post(
  '/sections/:id/generate/content',
  zValidator('param', idParamSchema),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const [section] = await db.select().from(sections).where(eq(sections.id, id));
    if (!section) return c.json({ error: 'Section not found' }, 404);
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, section.chapterId));
    if (!chapter) return c.json({ error: 'Chapter not found' }, 404);

    // 前の節の本文を取得
    const previousSections = await db
      .select()
      .from(sections)
      .where(eq(sections.chapterId, section.chapterId))
      .orderBy(sections.order);
    const prevIndex = previousSections.findIndex((s) => s.id === id);
    let previousContent: string | undefined;
    if (prevIndex > 0) {
      const prevSection = previousSections[prevIndex - 1];
      const [prevContent] = await db
        .select()
        .from(contents)
        .where(eq(contents.sectionId, prevSection.id));
      previousContent = prevContent?.body;
    }

    const context = await searchContext(
      c.var.vectorStore,
      c.var.embedding,
      chapter.novelId,
      {
        query: `${section.title ?? ''} ${section.summary ?? ''}`,
        previousContent,
      },
      c.var.env,
    );

    const prompt = contentGeneration(
      { title: section.title ?? undefined, summary: section.summary ?? '' },
      {
        previousContent: context.previousContent,
        characters: context.characters,
        settings: context.settings,
      },
    );

    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    return stream(c, async (s: StreamingApi) => {
      for await (const chunk of streamText(c.var.llm, prompt)) {
        await s.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      await s.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    });
  },
);

// POST /api/sections/:id/generate/content-auto - 本文生成 + 自動整合性更新
// 本文を SSE でストリーミングし、完了後に時系列・設定の抽出結果を JSON イベントとして送信する。
// 抽出結果は DB に保存せず、クライアントで確認後に保存できるよう返すのみ。
generateRouter.post(
  '/sections/:id/generate/content-auto',
  zValidator('param', idParamSchema),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const [section] = await db.select().from(sections).where(eq(sections.id, id));
    if (!section) return c.json({ error: 'Section not found' }, 404);
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, section.chapterId));
    if (!chapter) return c.json({ error: 'Chapter not found' }, 404);

    // 前の節の本文を取得
    const previousSections = await db
      .select()
      .from(sections)
      .where(eq(sections.chapterId, section.chapterId))
      .orderBy(sections.order);
    const prevIndex = previousSections.findIndex((s) => s.id === id);
    let previousContent: string | undefined;
    if (prevIndex > 0) {
      const prevSection = previousSections[prevIndex - 1];
      const [prevContent] = await db
        .select()
        .from(contents)
        .where(eq(contents.sectionId, prevSection.id));
      previousContent = prevContent?.body;
    }

    const context = await searchContext(
      c.var.vectorStore,
      c.var.embedding,
      chapter.novelId,
      {
        query: `${section.title ?? ''} ${section.summary ?? ''}`,
        previousContent,
      },
      c.var.env,
    );

    const prompt = contentGeneration(
      { title: section.title ?? undefined, summary: section.summary ?? '' },
      {
        previousContent: context.previousContent,
        characters: context.characters,
        settings: context.settings,
      },
    );

    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    return stream(c, async (s: StreamingApi) => {
      // 本文をストリーミングしつつ蓄積する
      let body = '';
      for await (const chunk of streamText(c.var.llm, prompt)) {
        body += chunk;
        await s.write(`event: chunk\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
      }

      // 本文生成完了後、整合性更新（時系列・設定の抽出）を実行する
      const novelId = chapter.novelId;

      // 時系列抽出（DB 保存なし）
      const timelinePrompt = extractTimeline(body);
      const timelineResult = await generateJSON<{ time?: string; event: string; order: number }[]>(
        c.var.llm,
        timelinePrompt,
      );
      const timelinesResult = timelineResult.map((item) => ({
        event: item.event,
        order: item.order,
        timestamp: item.time ?? null,
      }));

      // 設定抽出（DB 保存なし）
      const existingSettings = await db
        .select()
        .from(settings)
        .where(eq(settings.novelId, novelId));
      const settingsPrompt = extractSettings(
        body,
        existingSettings.map((s) => `${s.name}: ${s.description ?? ''}`),
      );
      const settingsResult = await generateJSON<
        { category: string; name: string; description: string }[]
      >(c.var.llm, settingsPrompt);
      const settingsExtracted = settingsResult.map((item) => ({
        category: item.category,
        name: item.name,
        description: item.description,
      }));

      // 抽出結果を JSON イベントとして送信
      await s.write(
        `event: extract\ndata: ${JSON.stringify({
          timelines: timelinesResult,
          settings: settingsExtracted,
        })}\n\n`,
      );

      // 完了イベント
      await s.write(`event: done\ndata: {}\n\n`);
    });
  },
);

// POST /api/sections/:id/generate/extract - 整合性更新
generateRouter.post(
  '/sections/:id/generate/extract',
  zValidator('param', idParamSchema),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const [section] = await db.select().from(sections).where(eq(sections.id, id));
    if (!section) return c.json({ error: 'Section not found' }, 404);
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, section.chapterId));
    if (!chapter) return c.json({ error: 'Chapter not found' }, 404);
    const [content] = await db.select().from(contents).where(eq(contents.sectionId, id));
    if (!content) return c.json({ error: 'Content not found' }, 404);

    const novelId = chapter.novelId;

    // 時系列抽出
    const timelinePrompt = extractTimeline(content.body);
    const timelineResult = await generateJSON<{ time?: string; event: string; order: number }[]>(
      c.var.llm,
      timelinePrompt,
    );

    const savedTimelines: (typeof timelines.$inferSelect)[] = [];
    for (const item of timelineResult) {
      const [row] = await db
        .insert(timelines)
        .values({
          novelId,
          sectionId: id,
          event: item.event,
          order: item.order,
          timestamp: item.time ?? null,
        })
        .returning();
      savedTimelines.push(row);
    }

    // 設定抽出
    const existingSettings = await db.select().from(settings).where(eq(settings.novelId, novelId));
    const settingsPrompt = extractSettings(
      content.body,
      existingSettings.map((s) => `${s.name}: ${s.description ?? ''}`),
    );
    const settingsResult = await generateJSON<
      { category: string; name: string; description: string }[]
    >(c.var.llm, settingsPrompt);

    const savedSettings: (typeof settings.$inferSelect)[] = [];
    for (const item of settingsResult) {
      const existing = existingSettings.find(
        (s) => s.name === item.name && s.category === item.category,
      );
      let row: typeof settings.$inferSelect;
      if (existing) {
        const [updated] = await db
          .update(settings)
          .set({ description: item.description, updatedAt: new Date() })
          .where(eq(settings.id, existing.id))
          .returning();
        row = updated;
      } else {
        const [created] = await db
          .insert(settings)
          .values({
            novelId,
            category: item.category,
            name: item.name,
            description: item.description,
          })
          .returning();
        row = created;
      }
      await upsertEntityEmbedding(
        c.var.vectorStore,
        c.var.embedding,
        novelId,
        'setting',
        row.id,
        `[${row.category}] ${row.name}\n${row.description ?? ''}`,
        c.var.env,
      );
      savedSettings.push(row);
    }

    return c.json({ timelines: savedTimelines, settings: savedSettings });
  },
);

export default generateRouter;
