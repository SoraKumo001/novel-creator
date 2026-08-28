import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { AppContext } from '../context.js';
import { ContentDomainService, NotFoundError } from '../core/index.js';
import { idParamSchema, updateContentSchema } from '../schemas/index.js';

const contentsRouter = new Hono<AppContext>()
  // GET /api/contents/:id - 本文取得（sectionId 指定）
  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const service = new ContentDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    try {
      const row = await service.getContent(id);
      return c.json(row);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Content not found' }, 404);
      }
      throw err;
    }
  })
  // PUT /api/contents/:id - 本文更新（sectionId 指定）
  .put(
    '/:id',
    zValidator('param', idParamSchema),
    zValidator('json', updateContentSchema),
    async (c) => {
      const service = new ContentDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await service.updateContent(id, body.body);
      return c.json(row);
    },
  );

export default contentsRouter;
