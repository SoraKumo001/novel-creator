import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { AppContext } from '../context.js';
import { HistoryDomainService, NotFoundError } from '../core/index.js';
import { idParamSchema, listHistoriesQuerySchema } from '../schemas/index.js';

const historiesRouter = new Hono<AppContext>()
  // GET /api/histories - 履歴一覧取得
  .get('/', zValidator('query', listHistoriesQuerySchema), async (c) => {
    const service = new HistoryDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { novelId, entityType, entityId, limit } = c.req.valid('query');
    const rows = await service.listHistories(novelId, { entityType, entityId, limit });
    return c.json(rows);
  })
  // GET /api/histories/:id - 履歴個別取得
  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const service = new HistoryDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    try {
      const row = await service.getHistory(id);
      return c.json(row);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'History not found' }, 404);
      }
      throw err;
    }
  })
  // POST /api/histories/:id/restore - 履歴復元
  .post('/:id/restore', zValidator('param', idParamSchema), async (c) => {
    const service = new HistoryDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    try {
      const result = await service.restoreHistory(id);
      return c.json(result);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'History not found' }, 404);
      }
      throw err;
    }
  });

export default historiesRouter;
