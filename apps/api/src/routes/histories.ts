import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { AppContext } from '../context.js';
import { getServices } from '../core/services.js';
import { idParamSchema, listHistoriesQuerySchema } from '../schemas/index.js';

const historiesRouter = new Hono<AppContext>()
  // GET /api/histories - 履歴一覧取得
  .get('/', zValidator('query', listHistoriesQuerySchema), async (c) => {
    const { novelId, entityType, entityId, limit } = c.req.valid('query');
    const rows = await getServices(c).history.listHistories(novelId, {
      entityType,
      entityId,
      limit,
    });
    return c.json(rows);
  })
  // GET /api/histories/:id - 履歴個別取得
  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const row = await getServices(c).history.getHistory(id);
    return c.json(row);
  })
  // POST /api/histories/:id/restore - 履歴復元
  .post('/:id/restore', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const result = await getServices(c).history.restoreHistory(id);
    return c.json(result);
  });

export default historiesRouter;
