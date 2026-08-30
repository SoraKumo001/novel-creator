import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppContext } from '../../context.js';
import { getServices } from '../../core/services.js';
import { createTimelineSchema, idParamSchema } from '../../schemas/index.js';

export const novelTimelinesRouter = new Hono<AppContext>()
  // GET /api/novels/:id/timelines - 時系列一覧
  .get('/:id/timelines', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const rows = await getServices(c).timeline.listTimelines(id);
    return c.json(rows);
  })
  // POST /api/novels/:id/timelines - 時系列作成
  .post(
    '/:id/timelines',
    zValidator('param', idParamSchema),
    zValidator('json', createTimelineSchema),
    async (c) => {
      const { id: novelId } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await getServices(c).timeline.createTimeline({
        novelId,
        sectionId: body.sectionId || null,
        event: body.event,
        order: body.order,
        timestamp: body.timestamp || null,
      });
      return c.json(row, 201);
    },
  );
