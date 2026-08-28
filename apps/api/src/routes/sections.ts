import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import type { AppContext } from '../context.js';
import { getServices } from '../core/services.js';
import { idParamSchema, updateContentSchema, updateSectionSchema } from '../schemas/index.js';

const sectionsRouter = new Hono<AppContext>()
  // GET /api/sections/:id - 節個別取得（本文含む）
  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const result = await getServices(c).section.getSectionWithContent(id);
    return c.json({
      ...result.section,
      content: result.content,
    });
  })
  // PUT /api/sections/:id - 節更新
  .put(
    '/:id',
    zValidator('param', idParamSchema),
    zValidator('json', updateSectionSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await getServices(c).section.updateSection(id, body);
      return c.json(row);
    },
  )
  // DELETE /api/sections/:id - 節削除
  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    await getServices(c).section.deleteSection(id);
    return c.json({ success: true });
  })
  // GET /api/sections/:id/content - 本文取得
  .get('/:id/content', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const row = await getServices(c).content.getContent(id);
    return c.json(row);
  })
  // PUT /api/sections/:id/content - 本文更新
  .put(
    '/:id/content',
    zValidator('param', idParamSchema),
    zValidator('json', updateContentSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await getServices(c).content.updateContent(id, body.body);
      return c.json(row);
    },
  )
  // POST /api/sections/:id/generate/summary - 節概要生成
  .post('/:id/generate/summary', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const result = await getServices(c).generate.generateSectionSummary(id);
    return c.json(result);
  })
  // POST /api/sections/:id/generate/content - 本文ストリーミング生成
  .post('/:id/generate/content', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const stream = getServices(c).generate.generateSectionContent(id);
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  })
  // POST /api/sections/:id/generate/extract - 本文から設定・時系列を抽出
  .post('/:id/generate/extract', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const result = await getServices(c).generate.extractEntities(id);
    return c.json(result);
  })
  // POST /api/sections/:id/generate/proofread - 本文校正・推敲・レビュー
  .post(
    '/:id/generate/proofread',
    zValidator('param', idParamSchema),
    zValidator('json', z.object({ body: z.string().optional() }).optional()),
    async (c) => {
      const { id } = c.req.valid('param');
      const jsonBody = c.req.valid('json');
      const result = await getServices(c).generate.proofreadContent(id, jsonBody?.body);
      return c.json(result);
    },
  );

export default sectionsRouter;
