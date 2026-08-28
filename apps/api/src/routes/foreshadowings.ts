import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { AppContext } from '../context.js';
import { getServices } from '../core/services.js';
import {
  createForeshadowingSchema,
  idParamSchema,
  novelIdParamSchema,
  updateForeshadowingSchema,
} from '../schemas/index.js';

const foreshadowingsRouter = new Hono<AppContext>()
  // GET /api/foreshadowings/novel/:novelId - 小説の伏線一覧取得
  .get('/novel/:novelId', zValidator('param', novelIdParamSchema), async (c) => {
    const { novelId } = c.req.valid('param');
    const items = await getServices(c).foreshadowing.getForeshadowingsByNovel(novelId);
    return c.json(items);
  })
  // POST /api/foreshadowings/novel/:novelId - 伏線新規作成
  .post(
    '/novel/:novelId',
    zValidator('param', novelIdParamSchema),
    zValidator('json', createForeshadowingSchema),
    async (c) => {
      const { novelId } = c.req.valid('param');
      const body = c.req.valid('json');
      const item = await getServices(c).foreshadowing.createForeshadowing(novelId, body);
      return c.json(item, 201);
    },
  )
  // GET /api/foreshadowings/:id - 伏線個別取得
  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const item = await getServices(c).foreshadowing.getForeshadowing(id);
    return c.json(item);
  })
  // PUT /api/foreshadowings/:id - 伏線更新
  .put(
    '/:id',
    zValidator('param', idParamSchema),
    zValidator('json', updateForeshadowingSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const item = await getServices(c).foreshadowing.updateForeshadowing(id, body);
      return c.json(item);
    },
  )
  // DELETE /api/foreshadowings/:id - 伏線削除
  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    await getServices(c).foreshadowing.deleteForeshadowing(id);
    return c.json({ success: true as const });
  });

export default foreshadowingsRouter;
