import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { characters } from '@novel-creator/db';

import type { AppContext } from '../context.js';
import { upsertEntityEmbedding } from '../rag.js';
import {
  createCharacterSchema,
  idParamSchema,
  novelIdParamSchema,
  updateCharacterSchema,
} from '../schemas/index.js';

const charactersRouter = new Hono<AppContext>();

// GET /api/novels/:novelId/characters - 人物一覧
charactersRouter.get(
  '/novels/:novelId/characters',
  zValidator('param', novelIdParamSchema),
  async (c) => {
    const db = c.var.db;
    const { novelId } = c.req.valid('param');
    const rows = await db.select().from(characters).where(eq(characters.novelId, novelId));
    return c.json(rows);
  },
);

// POST /api/novels/:novelId/characters - 人物作成
charactersRouter.post(
  '/novels/:novelId/characters',
  zValidator('param', novelIdParamSchema),
  zValidator('json', createCharacterSchema),
  async (c) => {
    const db = c.var.db;
    const { novelId } = c.req.valid('param');
    const body = c.req.valid('json');
    const [row] = await db
      .insert(characters)
      .values({
        novelId,
        name: body.name,
        description: body.description ?? null,
        traits: body.traits ?? null,
        relationships: body.relationships ?? null,
      })
      .returning();

    await upsertEntityEmbedding(
      c.var.vectorStore,
      c.var.embedding,
      novelId,
      'character',
      row.id,
      characterToText(row),
      c.var.env,
    );

    return c.json(row, 201);
  },
);

// GET /api/characters/:id - 個別取得
charactersRouter.get('/characters/:id', zValidator('param', idParamSchema), async (c) => {
  const db = c.var.db;
  const { id } = c.req.valid('param');
  const [row] = await db.select().from(characters).where(eq(characters.id, id));
  if (!row) return c.json({ error: 'Character not found' }, 404);
  return c.json(row);
});

// PUT /api/characters/:id - 更新
charactersRouter.put(
  '/characters/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateCharacterSchema),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const [row] = await db
      .update(characters)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(characters.id, id))
      .returning();
    if (!row) return c.json({ error: 'Character not found' }, 404);

    await upsertEntityEmbedding(
      c.var.vectorStore,
      c.var.embedding,
      row.novelId,
      'character',
      row.id,
      characterToText(row),
      c.var.env,
    );

    return c.json(row);
  },
);

// DELETE /api/characters/:id - 削除
charactersRouter.delete('/characters/:id', zValidator('param', idParamSchema), async (c) => {
  const db = c.var.db;
  const { id } = c.req.valid('param');
  const [row] = await db.delete(characters).where(eq(characters.id, id)).returning();
  if (!row) return c.json({ error: 'Character not found' }, 404);
  await c.var.vectorStore.deleteByEntity('character', id);
  return c.json({ success: true });
});

function characterToText(character: {
  name: string;
  description?: string | null;
  traits?: string[] | null;
}): string {
  const parts = [character.name];
  if (character.description) parts.push(character.description);
  if (character.traits?.length) parts.push(`特徴: ${character.traits.join('、')}`);
  return parts.join('\n');
}

export default charactersRouter;
