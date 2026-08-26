import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { settings } from '@novel-creator/db';
import { editSettingSection, generateText } from '@novel-creator/llm';
import {
  diffSettings,
  parseSettingsMarkdown,
  serializeSettingsToMarkdown,
} from '@novel-creator/shared';

import type { AppContext } from '../context.js';
import { searchContext, upsertEntityEmbedding } from '../rag.js';
import {
  createSettingSchema,
  editSettingSectionSchema,
  idParamSchema,
  novelIdParamSchema,
  saveSettingsMarkdownSchema,
  updateSettingSchema,
} from '../schemas/index.js';

const settingsRouter = new Hono<AppContext>();

// GET /api/novels/:novelId/settings/markdown - 設定をマークダウン文書として取得
settingsRouter.get(
  '/novels/:novelId/settings/markdown',
  zValidator('param', novelIdParamSchema),
  async (c) => {
    const db = c.var.db;
    const { novelId } = c.req.valid('param');
    const rows = await db.select().from(settings).where(eq(settings.novelId, novelId));
    const markdown = serializeSettingsToMarkdown(rows);
    return c.json({ markdown });
  },
);

// PUT /api/novels/:novelId/settings/markdown - マークダウンを解析してDBを同期
settingsRouter.put(
  '/novels/:novelId/settings/markdown',
  zValidator('param', novelIdParamSchema),
  zValidator('json', saveSettingsMarkdownSchema),
  async (c) => {
    const db = c.var.db;
    const { novelId } = c.req.valid('param');
    const { markdown } = c.req.valid('json');

    const existing = await db.select().from(settings).where(eq(settings.novelId, novelId));
    const parsed = parseSettingsMarkdown(markdown);
    const diff = diffSettings(existing, parsed);

    // DB 操作をトランザクションで実行
    const createdIds: string[] = [];
    await db.transaction(async (tx) => {
      for (const s of diff.toCreate) {
        const [row] = await tx
          .insert(settings)
          .values({
            novelId,
            category: s.category,
            name: s.name,
            description: s.description,
          })
          .returning();
        createdIds.push(row.id);
      }
      for (const u of diff.toUpdate) {
        await tx
          .update(settings)
          .set({ description: u.description, updatedAt: new Date() })
          .where(eq(settings.id, u.id));
      }
      for (const id of diff.toDelete) {
        await tx.delete(settings).where(eq(settings.id, id));
      }
    });

    // 埋め込み更新（非同期副作用のためトランザクション外）
    for (let i = 0; i < diff.toCreate.length; i++) {
      const s = diff.toCreate[i];
      await upsertEntityEmbedding(
        c.var.vectorStore,
        c.var.embedding,
        novelId,
        'setting',
        createdIds[i],
        settingToText(s),
        c.var.env,
      );
    }
    for (const u of diff.toUpdate) {
      await upsertEntityEmbedding(
        c.var.vectorStore,
        c.var.embedding,
        novelId,
        'setting',
        u.id,
        settingToText(u),
        c.var.env,
      );
    }
    for (const id of diff.toDelete) {
      await c.var.vectorStore.deleteByEntity('setting', id);
    }

    return c.json({
      created: diff.toCreate.length,
      updated: diff.toUpdate.length,
      deleted: diff.toDelete.length,
      duplicateCount: diff.duplicateCount,
    });
  },
);

// POST /api/novels/:novelId/settings/edit-section - セクションをLLMで編集（DB書き込みなし）
settingsRouter.post(
  '/novels/:novelId/settings/edit-section',
  zValidator('param', novelIdParamSchema),
  zValidator('json', editSettingSectionSchema),
  async (c) => {
    const { novelId } = c.req.valid('param');
    const { category, name, description, instruction } = c.req.valid('json');

    const ctx = await searchContext(
      c.var.vectorStore,
      c.var.embedding,
      novelId,
      { query: `${description} ${instruction}` },
      c.var.env,
    );

    const prompt = editSettingSection({ category, name, description }, instruction, {
      settings: ctx.settings,
      characters: ctx.characters,
    });

    const result = await generateText(c.var.llm, prompt);
    return c.json({ markdown: result });
  },
);

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
