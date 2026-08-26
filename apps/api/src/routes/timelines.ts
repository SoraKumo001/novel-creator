import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { AppContext } from '../context.js';
import { NotFoundError, TimelineDomainService, ValidationError } from '../core/index.js';
import { createTimelineSchema, idParamSchema } from '../schemas/index.js';

const timelinesRouter = new Hono<AppContext>();

// GET /api/novels/:id/timelines - 時系列一覧
timelinesRouter.get('/novels/:id/timelines', zValidator('param', idParamSchema), async (c) => {
  const service = new TimelineDomainService({
    db: c.var.db,
    llm: c.var.llm,
    embedding: c.var.embedding,
    vectorStore: c.var.vectorStore,
    env: c.var.env,
  });
  const { id } = c.req.valid('param');
  const rows = await service.listTimelines(id);
  return c.json(rows);
});

// POST /api/novels/:id/timelines - 時系列作成
timelinesRouter.post(
  '/novels/:id/timelines',
  zValidator('param', idParamSchema),
  zValidator('json', createTimelineSchema),
  async (c) => {
    const service = new TimelineDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id: novelId } = c.req.valid('param');
    const body = c.req.valid('json');

    try {
      const row = await service.createTimeline({
        novelId,
        sectionId: body.sectionId || null,
        event: body.event,
        order: body.order,
        timestamp: body.timestamp || null,
      });
      return c.json(row, 201);
    } catch (err) {
      if (err instanceof ValidationError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }
  },
);

// DELETE /api/timelines/:id - 時系列削除
timelinesRouter.delete('/timelines/:id', zValidator('param', idParamSchema), async (c) => {
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
