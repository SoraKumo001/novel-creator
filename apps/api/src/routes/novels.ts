import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { chapters, characters, novels, settings } from '@novel-creator/db';

import type { AppContext } from '../context.js';
import { createNovelSchema, idParamSchema, updateNovelSchema } from '../schemas/index.js';

const novelsRouter = new Hono<AppContext>();

// GET /api/novels - 一覧取得
novelsRouter.get('/', async (c) => {
  const db = c.var.db;
  const rows = await db.select().from(novels).orderBy(desc(novels.createdAt));
  return c.json(rows);
});

// POST /api/novels - 作成
novelsRouter.post('/', zValidator('json', createNovelSchema), async (c) => {
  const db = c.var.db;
  const body = c.req.valid('json');
  const [row] = await db
    .insert(novels)
    .values({ title: body.title, description: body.description ?? null })
    .returning();
  return c.json(row, 201);
});

// GET /api/novels/:id - 個別取得（関連データ含む）
novelsRouter.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const db = c.var.db;
  const { id } = c.req.valid('param');
  const [novel] = await db.select().from(novels).where(eq(novels.id, id));
  if (!novel) return c.json({ error: 'Novel not found' }, 404);

  const [chapterRows, characterRows, settingRows] = await Promise.all([
    db.select().from(chapters).where(eq(chapters.novelId, id)).orderBy(chapters.order),
    db.select().from(characters).where(eq(characters.novelId, id)),
    db.select().from(settings).where(eq(settings.novelId, id)),
  ]);

  return c.json({
    ...novel,
    chapters: chapterRows,
    characters: characterRows,
    settings: settingRows,
  });
});

// PUT /api/novels/:id - 更新
novelsRouter.put(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateNovelSchema),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const [row] = await db
      .update(novels)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(novels.id, id))
      .returning();
    if (!row) return c.json({ error: 'Novel not found' }, 404);
    return c.json(row);
  },
);

// DELETE /api/novels/:id - 削除
novelsRouter.delete('/:id', zValidator('param', idParamSchema), async (c) => {
  const db = c.var.db;
  const { id } = c.req.valid('param');
  const [row] = await db.delete(novels).where(eq(novels.id, id)).returning();
  if (!row) return c.json({ error: 'Novel not found' }, 404);
  return c.json({ success: true });
});

export default novelsRouter;
