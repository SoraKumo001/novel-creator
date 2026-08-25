import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { timelines, type Database } from '@novel-creator/db';

import type { AppContext } from '../context.js';
import { createTimelineSchema, idParamSchema, novelIdParamSchema } from '../schemas/index.js';

const timelinesRouter = new Hono<AppContext>();

// GET /api/novels/:novelId/timelines - 時系列一覧（order順）
timelinesRouter.get(
  '/novels/:novelId/timelines',
  zValidator('param', novelIdParamSchema),
  async (c) => {
    const db = c.var.db;
    const { novelId } = c.req.valid('param');
    const rows = await db
      .select()
      .from(timelines)
      .where(eq(timelines.novelId, novelId))
      .orderBy(timelines.order);
    return c.json(rows);
  },
);

// POST /api/novels/:novelId/timelines - 作成
timelinesRouter.post(
  '/novels/:novelId/timelines',
  zValidator('param', novelIdParamSchema),
  zValidator('json', createTimelineSchema),
  async (c) => {
    const db = c.var.db;
    const { novelId } = c.req.valid('param');
    const body = c.req.valid('json');
    const order = body.order ?? (await nextTimelineOrder(db, novelId));
    const [row] = await db
      .insert(timelines)
      .values({
        novelId,
        sectionId: body.sectionId ?? null,
        event: body.event,
        order,
        timestamp: body.timestamp ?? null,
      })
      .returning();
    return c.json(row, 201);
  },
);

// DELETE /api/timelines/:id - 削除
timelinesRouter.delete('/timelines/:id', zValidator('param', idParamSchema), async (c) => {
  const db = c.var.db;
  const { id } = c.req.valid('param');
  const [row] = await db.delete(timelines).where(eq(timelines.id, id)).returning();
  if (!row) return c.json({ error: 'Timeline not found' }, 404);
  return c.json({ success: true });
});

async function nextTimelineOrder(db: Database, novelId: string): Promise<number> {
  const rows = await db
    .select({ order: timelines.order })
    .from(timelines)
    .where(eq(timelines.novelId, novelId))
    .orderBy(timelines.order);
  return rows.length > 0 ? (rows[rows.length - 1].order ?? 0) + 1 : 1;
}

export default timelinesRouter;
