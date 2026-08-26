import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import type { StreamingApi } from 'hono/utils/stream';
import { zValidator } from '@hono/zod-validator';

import { contents, settings, timelines } from '@novel-creator/db';
import { extractSettings, extractTimeline, generateJSON } from '@novel-creator/llm';

import type { AppContext } from '../context.js';
import {
  ChapterDomainService,
  GenerateDomainService,
  NotFoundError,
  SectionDomainService,
} from '../core/index.js';
import { upsertEntityEmbedding } from '../rag.js';
import { idParamSchema, novelIdParamSchema } from '../schemas/index.js';

const generateRouter = new Hono<AppContext>();

// POST /api/novels/:novelId/generate/plot - プロット生成
generateRouter.post(
  '/novels/:novelId/generate/plot',
  zValidator('param', novelIdParamSchema),
  async (c) => {
    const service = new GenerateDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { novelId } = c.req.valid('param');
    try {
      const result = await service.generatePlot(novelId);
      return c.json(result);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Novel not found' }, 404);
      }
      throw err;
    }
  },
);

// POST /api/chapters/:id/generate/summary - 章の概要生成
generateRouter.post(
  '/chapters/:id/generate/summary',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = new GenerateDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    try {
      const result = await service.generateChapterSummary(id);
      return c.json(result);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Chapter not found' }, 404);
      }
      throw err;
    }
  },
);

// POST /api/sections/:id/generate/summary - 節の概要生成
generateRouter.post(
  '/sections/:id/generate/summary',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = new GenerateDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    try {
      const result = await service.generateSectionSummary(id);
      return c.json(result);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Section not found' }, 404);
      }
      throw err;
    }
  },
);

// POST /api/sections/:id/generate/content - 本文生成（ストリーミング）
generateRouter.post(
  '/sections/:id/generate/content',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = new GenerateDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');

    try {
      const streamGenerator = service.generateSectionContent(id);

      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');

      return stream(c, async (s: StreamingApi) => {
        for await (const chunk of streamGenerator) {
          await s.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        }
        await s.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Section not found' }, 404);
      }
      throw err;
    }
  },
);

// POST /api/sections/:id/generate/content-auto - 本文生成 + 自動整合性更新
generateRouter.post(
  '/sections/:id/generate/content-auto',
  zValidator('param', idParamSchema),
  async (c) => {
    const ctx = {
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    };
    const sectionService = new SectionDomainService(ctx);
    const chapterService = new ChapterDomainService(ctx);
    const generateService = new GenerateDomainService(ctx);

    const { id } = c.req.valid('param');
    const { section } = await sectionService.getSectionWithContent(id);
    const { chapter } = await chapterService.getChapterWithSections(section.chapterId);

    const streamGenerator = generateService.generateSectionContent(id);

    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    return stream(c, async (s: StreamingApi) => {
      let body = '';
      for await (const chunk of streamGenerator) {
        body += chunk;
        await s.write(`event: chunk\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
      }

      const novelId = chapter.novelId;

      // 時系列抽出
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

      // 設定抽出
      const existingSettings = await c.var.db
        .select()
        .from(settings)
        .where(eq(settings.novelId, novelId));
      const settingsPrompt = extractSettings(
        body,
        existingSettings.map((item) => `${item.name}: ${item.description ?? ''}`),
      );
      const settingsResult = await generateJSON<
        { category: string; name: string; description: string }[]
      >(c.var.llm, settingsPrompt);
      const settingsExtracted = settingsResult.map((item) => ({
        category: item.category,
        name: item.name,
        description: item.description,
      }));

      await s.write(
        `event: extract\ndata: ${JSON.stringify({
          timelines: timelinesResult,
          settings: settingsExtracted,
        })}\n\n`,
      );

      await s.write(`event: done\ndata: {}\n\n`);
    });
  },
);

// POST /api/sections/:id/generate/extract - 整合性更新（DB保存）
generateRouter.post(
  '/sections/:id/generate/extract',
  zValidator('param', idParamSchema),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const [section] = await db.select().from(contents).where(eq(contents.sectionId, id));
    if (!section) return c.json({ error: 'Section content not found' }, 404);

    const sectionService = new SectionDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { section: sec } = await sectionService.getSectionWithContent(id);

    const chapterService = new ChapterDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { chapter } = await chapterService.getChapterWithSections(sec.chapterId);
    const novelId = chapter.novelId;

    // 時系列抽出
    const timelinePrompt = extractTimeline(section.body);
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
      section.body,
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
