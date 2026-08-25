import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { characters, settings } from '@novel-creator/db';
import { createSettingDraft, editCharacter, editSetting, generateJSON } from '@novel-creator/llm';

import type { AppContext } from '../context.js';
import { upsertEntityEmbedding } from '../rag.js';
import {
  editInstructionSchema,
  idParamSchema,
  novelIdParamSchema,
  settingDraftSchema,
} from '../schemas/index.js';

const llmEditRouter = new Hono<AppContext>();

// POST /api/characters/:id/edit - 人物情報をLLMで編集
llmEditRouter.post(
  '/characters/:id/edit',
  zValidator('param', idParamSchema),
  zValidator('json', editInstructionSchema),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const { instruction } = c.req.valid('json');
    const [character] = await db.select().from(characters).where(eq(characters.id, id));
    if (!character) return c.json({ error: 'Character not found' }, 404);

    const prompt = editCharacter(
      {
        name: character.name,
        description: character.description ?? undefined,
        traits: character.traits ?? undefined,
      },
      instruction,
    );

    const result = await generateJSON<{
      name: string;
      description: string;
      traits: string[];
    }>(c.var.llm, prompt);

    const [row] = await db
      .update(characters)
      .set({
        name: result.name,
        description: result.description,
        traits: result.traits,
        updatedAt: new Date(),
      })
      .where(eq(characters.id, id))
      .returning();

    await upsertEntityEmbedding(
      c.var.vectorStore,
      c.var.embedding,
      row.novelId,
      'character',
      row.id,
      `${row.name}\n${row.description ?? ''}\n特徴: ${row.traits?.join('、') ?? ''}`,
      c.var.env,
    );

    return c.json(row);
  },
);

// POST /api/settings/:id/edit - 設定をLLMで編集
llmEditRouter.post(
  '/settings/:id/edit',
  zValidator('param', idParamSchema),
  zValidator('json', editInstructionSchema),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const { instruction } = c.req.valid('json');
    const [setting] = await db.select().from(settings).where(eq(settings.id, id));
    if (!setting) return c.json({ error: 'Setting not found' }, 404);

    const prompt = editSetting(
      {
        category: setting.category,
        name: setting.name,
        description: setting.description ?? undefined,
      },
      instruction,
    );

    const result = await generateJSON<{
      category: string;
      name: string;
      description: string;
    }>(c.var.llm, prompt);

    const [row] = await db
      .update(settings)
      .set({
        category: result.category,
        name: result.name,
        description: result.description,
        updatedAt: new Date(),
      })
      .where(eq(settings.id, id))
      .returning();

    await upsertEntityEmbedding(
      c.var.vectorStore,
      c.var.embedding,
      row.novelId,
      'setting',
      row.id,
      `[${row.category}] ${row.name}\n${row.description ?? ''}`,
      c.var.env,
    );

    return c.json(row);
  },
);

// POST /api/novels/:novelId/settings/draft - 設定ドラフトをLLMで生成（DB書き込みなし）
llmEditRouter.post(
  '/novels/:novelId/settings/draft',
  zValidator('param', novelIdParamSchema),
  zValidator('json', settingDraftSchema),
  async (c) => {
    const { instruction, currentDraft } = c.req.valid('json');
    const prompt = createSettingDraft(instruction, currentDraft);
    const result = await generateJSON<{
      category: string;
      name: string;
      description: string;
    }>(c.var.llm, prompt);
    return c.json(result);
  },
);

export default llmEditRouter;
