import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { AppContext } from '../context.js';
import { NotFoundError, TimelineDomainService } from '../core/index.js';
import { idParamSchema } from '../schemas/index.js';

const timelinesRouter = new Hono<AppContext>()
  // DELETE /api/timelines/:id - 時系列削除
  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const service = new TimelineDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    try {
      await service.deleteTimeline(id);
      return c.json({ success: true });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Timeline not found' }, 404);
      }
      throw err;
    }
  });

export default timelinesRouter;
