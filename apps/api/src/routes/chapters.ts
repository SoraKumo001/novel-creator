import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { AppContext } from '../context.js';
import {
  ChapterDomainService,
  GenerateDomainService,
  NotFoundError,
  SectionDomainService,
} from '../core/index.js';
import { createSectionSchema, idParamSchema, updateChapterSchema } from '../schemas/index.js';

const chaptersRouter = new Hono<AppContext>()
  // GET /api/chapters/:id - 章個別取得（節一覧含む）
  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const service = new ChapterDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    try {
      const result = await service.getChapterWithSections(id);
      return c.json({
        ...result.chapter,
        sections: result.sections,
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Chapter not found' }, 404);
      }
      throw err;
    }
  })
  // PUT /api/chapters/:id - 章更新
  .put(
    '/:id',
    zValidator('param', idParamSchema),
    zValidator('json', updateChapterSchema),
    async (c) => {
      const service = new ChapterDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const row = await service.updateChapter(id, body);
        return c.json(row);
      } catch (err) {
        if (err instanceof NotFoundError) {
          return c.json({ error: 'Chapter not found' }, 404);
        }
        throw err;
      }
    },
  )
  // DELETE /api/chapters/:id - 章削除
  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const service = new ChapterDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    try {
      await service.deleteChapter(id);
      return c.json({ success: true });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Chapter not found' }, 404);
      }
      throw err;
    }
  })
  // POST /api/chapters/:id/sections - 節作成（章配下）
  .post(
    '/:id/sections',
    zValidator('param', idParamSchema),
    zValidator('json', createSectionSchema),
    async (c) => {
      const service = new SectionDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id: chapterId } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await service.createSection({
        chapterId,
        title: body.title,
        order: body.order,
        summary: body.summary,
      });
      return c.json(row, 201);
    },
  )
  // POST /api/chapters/:id/generate/summary - 章概要生成
  .post('/:id/generate/summary', zValidator('param', idParamSchema), async (c) => {
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
  });

export default chaptersRouter;
