import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { AppContext } from '../context.js';
import { getServices } from '../core/services.js';
import { createSectionSchema, idParamSchema, updateChapterSchema } from '../schemas/index.js';

const chaptersRouter = new Hono<AppContext>()
  // GET /api/chapters/:id - 章個別取得（節一覧含む）
  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const result = await getServices(c).chapter.getChapterWithSections(id);
    return c.json({
      ...result.chapter,
      sections: result.sections,
    });
  })
  // PUT /api/chapters/:id - 章更新
  .put(
    '/:id',
    zValidator('param', idParamSchema),
    zValidator('json', updateChapterSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await getServices(c).chapter.updateChapter(id, body);
      return c.json(row);
    },
  )
  // DELETE /api/chapters/:id - 章削除
  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    await getServices(c).chapter.deleteChapter(id);
    return c.json({ success: true });
  })
  // POST /api/chapters/:id/sections - 節作成（章配下）
  .post(
    '/:id/sections',
    zValidator('param', idParamSchema),
    zValidator('json', createSectionSchema),
    async (c) => {
      const { id: chapterId } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await getServices(c).section.createSection({
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
    const { id } = c.req.valid('param');
    const result = await getServices(c).generate.generateChapterSummary(id);
    return c.json(result);
  });

export default chaptersRouter;
