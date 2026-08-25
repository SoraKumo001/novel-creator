import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { contents, sections, type Database } from '@novel-creator/db';

import type { AppContext } from '../context.js';
import {
  chapterIdParamSchema,
  createSectionSchema,
  idParamSchema,
  updateSectionSchema,
} from '../schemas/index.js';

const sectionsRouter = new Hono<AppContext>();

// GET /api/chapters/:chapterId/sections - 節一覧（order順）
sectionsRouter.get(
  '/chapters/:chapterId/sections',
  zValidator('param', chapterIdParamSchema),
  async (c) => {
    const db = c.var.db;
    const { chapterId } = c.req.valid('param');
    const rows = await db
      .select()
      .from(sections)
      .where(eq(sections.chapterId, chapterId))
      .orderBy(sections.order);
    return c.json(rows);
  },
);

// POST /api/chapters/:chapterId/sections - 節作成
sectionsRouter.post(
  '/chapters/:chapterId/sections',
  zValidator('param', chapterIdParamSchema),
  zValidator('json', createSectionSchema),
  async (c) => {
    const db = c.var.db;
    const { chapterId } = c.req.valid('param');
    const body = c.req.valid('json');
    const order = body.order ?? (await nextSectionOrder(db, chapterId));
    const [row] = await db
      .insert(sections)
      .values({
        chapterId,
        title: body.title ?? null,
        order,
        summary: body.summary ?? null,
      })
      .returning();
    return c.json(row, 201);
  },
);

// GET /api/sections/:id - 個別取得（content含む）
sectionsRouter.get('/sections/:id', zValidator('param', idParamSchema), async (c) => {
  const db = c.var.db;
  const { id } = c.req.valid('param');
  const [section] = await db.select().from(sections).where(eq(sections.id, id));
  if (!section) return c.json({ error: 'Section not found' }, 404);
  const [content] = await db.select().from(contents).where(eq(contents.sectionId, id));
  return c.json({ ...section, content: content ?? null });
});

// PUT /api/sections/:id - 更新
sectionsRouter.put(
  '/sections/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateSectionSchema),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const [row] = await db
      .update(sections)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(sections.id, id))
      .returning();
    if (!row) return c.json({ error: 'Section not found' }, 404);
    return c.json(row);
  },
);

// DELETE /api/sections/:id - 削除
sectionsRouter.delete('/sections/:id', zValidator('param', idParamSchema), async (c) => {
  const db = c.var.db;
  const { id } = c.req.valid('param');
  const [row] = await db.delete(sections).where(eq(sections.id, id)).returning();
  if (!row) return c.json({ error: 'Section not found' }, 404);
  return c.json({ success: true });
});

async function nextSectionOrder(db: Database, chapterId: string): Promise<number> {
  const rows = await db
    .select({ order: sections.order })
    .from(sections)
    .where(eq(sections.chapterId, chapterId))
    .orderBy(sections.order);
  return rows.length > 0 ? (rows[rows.length - 1].order ?? 0) + 1 : 1;
}

export default sectionsRouter;
