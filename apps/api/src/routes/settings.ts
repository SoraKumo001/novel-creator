import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { settings } from '@novel-creator/db';

import type { AppContext } from '../context.js';
import { upsertEntityEmbedding } from '../rag.js';
import {
  createSettingSchema,
  idParamSchema,
  novelIdParamSchema,
  updateSettingSchema,
} from '../schemas/index.js';

const settingsRouter = new Hono<AppContext>();

// GET /api/novels/:novelId/settings - 設定一覧（categoryでフィルタ可能）
settingsRouter.get(
  '/novels/:novelId/settings',
  zValidator('param', novelIdParamSchema),
  async (c) => {
    const db = c.var.db;
    const { novelId } = c.req.valid('param');
    const category = c.req.query('category');
    const rows = category
      ? await db
          .select()
          .from(settings)
          .where(and(eq(settings.novelId, novelId), eq(settings.category, category)))
      : await db.select().from(settings).where(eq(settings.novelId, novelId));
    return c.json(rows);
  },
);

// POST /api/novels/:novelId/settings - 設定作成
settingsRouter.post(
  '/novels/:novelId/settings',
  zValidator('param', novelIdParamSchema),
  zValidator('json', createSettingSchema),
  async (c) => {
    const db = c.var.db;
    const { novelId } = c.req.valid('param');
    const body = c.req.valid('json');
    const [row] = await db
      .insert(settings)
      .values({
        novelId,
        category: body.category,
        name: body.name,
        description: body.description ?? null,
        metadata: body.metadata ?? null,
      })
      .returning();

    await upsertEntityEmbedding(
      c.var.vectorStore,
      c.var.embedding,
      novelId,
      'setting',
      row.id,
      settingToText(row),
      c.var.env,
    );

    return c.json(row, 201);
  },
);

// GET /api/settings/:id - 個別取得
settingsRouter.get('/settings/:id', zValidator('param', idParamSchema), async (c) => {
  const db = c.var.db;
  const { id } = c.req.valid('param');
  const [row] = await db.select().from(settings).where(eq(settings.id, id));
  if (!row) return c.json({ error: 'Setting not found' }, 404);
  return c.json(row);
});

// PUT /api/settings/:id - 更新
settingsRouter.put(
  '/settings/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateSettingSchema),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const [row] = await db
      .update(settings)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(settings.id, id))
      .returning();
    if (!row) return c.json({ error: 'Setting not found' }, 404);

    await upsertEntityEmbedding(
      c.var.vectorStore,
      c.var.embedding,
      row.novelId,
      'setting',
      row.id,
      settingToText(row),
      c.var.env,
    );

    return c.json(row);
  },
);

// DELETE /api/settings/:id - 削除
settingsRouter.delete('/settings/:id', zValidator('param', idParamSchema), async (c) => {
  const db = c.var.db;
  const { id } = c.req.valid('param');
  const [row] = await db.delete(settings).where(eq(settings.id, id)).returning();
  if (!row) return c.json({ error: 'Setting not found' }, 404);
  await c.var.vectorStore.deleteByEntity('setting', id);
  return c.json({ success: true });
});

function settingToText(setting: {
  category: string;
  name: string;
  description?: string | null;
}): string {
  const parts = [`[${setting.category}] ${setting.name}`];
  if (setting.description) parts.push(setting.description);
  return parts.join('\n');
}

export default settingsRouter;
