import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { characters } from '@novel-creator/db';
import { editCharacterDocument, editCharacterSection, generateText } from '@novel-creator/llm';
import {
  diffCharacters,
  parseCharactersMarkdown,
  serializeCharactersToMarkdown,
} from '@novel-creator/shared';

import type { AppContext } from '../context.js';
import { searchContext, upsertEntityEmbedding } from '../rag.js';
import {
  createCharacterSchema,
  editCharacterDocumentSchema,
  editCharacterSectionSchema,
  idParamSchema,
  novelIdParamSchema,
  saveCharactersMarkdownSchema,
  updateCharacterSchema,
} from '../schemas/index.js';

const charactersRouter = new Hono<AppContext>();

// GET /api/novels/:novelId/characters/markdown - 人物をマークダウン文書として取得
charactersRouter.get(
  '/novels/:novelId/characters/markdown',
  zValidator('param', novelIdParamSchema),
  async (c) => {
    const db = c.var.db;
    const { novelId } = c.req.valid('param');
    const rows = await db.select().from(characters).where(eq(characters.novelId, novelId));
    const markdown = serializeCharactersToMarkdown(rows);
    return c.json({ markdown });
  },
);

// PUT /api/novels/:novelId/characters/markdown - マークダウンを解析してDBを同期
charactersRouter.put(
  '/novels/:novelId/characters/markdown',
  zValidator('param', novelIdParamSchema),
  zValidator('json', saveCharactersMarkdownSchema),
  async (c) => {
    const db = c.var.db;
    const { novelId } = c.req.valid('param');
    const { markdown } = c.req.valid('json');

    const existing = await db.select().from(characters).where(eq(characters.novelId, novelId));
    const parsed = parseCharactersMarkdown(markdown);
    const diff = diffCharacters(existing, parsed);

    // DB 操作をトランザクションで実行
    const createdIds: string[] = [];
    await db.transaction(async (tx) => {
      for (const ch of diff.toCreate) {
        const [row] = await tx
          .insert(characters)
          .values({
            novelId,
            category: ch.category,
            name: ch.name,
            description: ch.description,
            traits: ch.traits,
            relationships: ch.relationships,
          })
          .returning();
        createdIds.push(row.id);
      }
      for (const u of diff.toUpdate) {
        await tx
          .update(characters)
          .set({
            category: u.category,
            description: u.description,
            traits: u.traits,
            relationships: u.relationships,
            updatedAt: new Date(),
          })
          .where(eq(characters.id, u.id));
      }
      for (const id of diff.toDelete) {
        await tx.delete(characters).where(eq(characters.id, id));
      }
    });

    // 埋め込み更新（非同期副作用のためトランザクション外）
    for (let i = 0; i < diff.toCreate.length; i++) {
      const ch = diff.toCreate[i];
      await upsertEntityEmbedding(
        c.var.vectorStore,
        c.var.embedding,
        novelId,
        'character',
        createdIds[i],
        characterToText(ch),
        c.var.env,
      );
    }
    for (const u of diff.toUpdate) {
      await upsertEntityEmbedding(
        c.var.vectorStore,
        c.var.embedding,
        novelId,
        'character',
        u.id,
        characterToText(u),
        c.var.env,
      );
    }
    for (const id of diff.toDelete) {
      await c.var.vectorStore.deleteByEntity('character', id);
    }

    return c.json({
      created: diff.toCreate.length,
      updated: diff.toUpdate.length,
      deleted: diff.toDelete.length,
      duplicateCount: diff.duplicateCount,
    });
  },
);

// POST /api/novels/:novelId/characters/edit-section - セクションをLLMで編集（DB書き込みなし）
charactersRouter.post(
  '/novels/:novelId/characters/edit-section',
  zValidator('param', novelIdParamSchema),
  zValidator('json', editCharacterSectionSchema),
  async (c) => {
    const { novelId } = c.req.valid('param');
    const { category, name, description, traits, relationships, instruction } = c.req.valid('json');

    const ctx = await searchContext(
      c.var.vectorStore,
      c.var.embedding,
      novelId,
      { query: `${description} ${instruction}` },
      c.var.env,
    );

    const prompt = editCharacterSection(
      { category, name, description, traits, relationships },
      instruction,
      { settings: ctx.settings, characters: ctx.characters },
    );

    const result = await generateText(c.var.llm, prompt);
    return c.json({ markdown: result });
  },
);

// POST /api/novels/:novelId/characters/edit-document - 文書全体をLLMで編集（DB書き込みなし）
charactersRouter.post(
  '/novels/:novelId/characters/edit-document',
  zValidator('param', novelIdParamSchema),
  zValidator('json', editCharacterDocumentSchema),
  async (c) => {
    const { novelId } = c.req.valid('param');
    const { markdown, instruction } = c.req.valid('json');

    const ctx = await searchContext(
      c.var.vectorStore,
      c.var.embedding,
      novelId,
      { query: instruction },
      c.var.env,
    );

    const prompt = editCharacterDocument(markdown, instruction, {
      settings: ctx.settings,
      characters: ctx.characters,
    });

    const result = await generateText(c.var.llm, prompt);
    return c.json({ markdown: result });
  },
);

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
        category: body.category ?? '未分類',
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
  category?: string | null;
  name: string;
  description?: string | null;
  traits?: string[] | null;
}): string {
  const cat = (character.category ?? '未分類').trim() || '未分類';
  const parts = [`[${cat}] ${character.name}`];
  if (character.description) parts.push(character.description);
  if (character.traits?.length) parts.push(`特徴: ${character.traits.join('、')}`);
  return parts.join('\n');
}

export default charactersRouter;
