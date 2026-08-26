import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { chapters, sections } from '@novel-creator/db';

import type { AppContext } from '../context.js';
import {
  createChapterSchema,
  idParamSchema,
  novelIdParamSchema,
  updateChapterSchema,
} from '../schemas/index.js';
import { getNextChapterOrder } from './helpers.js';

const chaptersRouter = new Hono<AppContext>();

// GET /api/novels/:novelId/chapters - 章一覧（order順）
chaptersRouter.get(
  '/novels/:novelId/chapters',
  zValidator('param', novelIdParamSchema),
  async (c) => {
    const db = c.var.db;
    const { novelId } = c.req.valid('param');
    const rows = await db
      .select()
      .from(chapters)
      .where(eq(chapters.novelId, novelId))
      .orderBy(chapters.order);
    return c.json(rows);
  },
);

// POST /api/novels/:novelId/chapters - 章作成
chaptersRouter.post(
  '/novels/:novelId/chapters',
  zValidator('param', novelIdParamSchema),
  zValidator('json', createChapterSchema),
  async (c) => {
    const db = c.var.db;
    const { novelId } = c.req.valid('param');
    const body = c.req.valid('json');
    const order = body.order ?? (await getNextChapterOrder(db, novelId));
    const [row] = await db
      .insert(chapters)
      .values({
        novelId,
        title: body.title,
        order,
        summary: body.summary ?? null,
      })
      .returning();
    return c.json(row, 201);
  },
);

// GET /api/chapters/:id - 個別取得（sections含む）
chaptersRouter.get('/chapters/:id', zValidator('param', idParamSchema), async (c) => {
  const db = c.var.db;
  const { id } = c.req.valid('param');
  const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id));
  if (!chapter) return c.json({ error: 'Chapter not found' }, 404);
  const sectionRows = await db
    .select()
    .from(sections)
    .where(eq(sections.chapterId, id))
    .orderBy(sections.order);
  return c.json({ ...chapter, sections: sectionRows });
});

// PUT /api/chapters/:id - 更新
chaptersRouter.put(
  '/chapters/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateChapterSchema),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const [row] = await db
      .update(chapters)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(chapters.id, id))
      .returning();
    if (!row) return c.json({ error: 'Chapter not found' }, 404);
    return c.json(row);
  },
);

// DELETE /api/chapters/:id - 削除
chaptersRouter.delete('/chapters/:id', zValidator('param', idParamSchema), async (c) => {
  const db = c.var.db;
  const { id } = c.req.valid('param');
  const [row] = await db.delete(chapters).where(eq(chapters.id, id)).returning();
  if (!row) return c.json({ error: 'Chapter not found' }, 404);
  return c.json({ success: true });
});

export default chaptersRouter;
