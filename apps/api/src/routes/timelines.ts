import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { AppContext } from '../context.js';
import { getServices } from '../core/services.js';
import { idParamSchema } from '../schemas/index.js';

const timelinesRouter = new Hono<AppContext>()
  // DELETE /api/timelines/:id - 時系列削除
  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    await getServices(c).timeline.deleteTimeline(id);
    return c.json({ success: true });
  });

export default timelinesRouter;
