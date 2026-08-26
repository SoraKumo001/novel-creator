import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { AppContext } from '../context.js';
import { CharacterDomainService, NotFoundError, SettingDomainService } from '../core/index.js';
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
    const service = new CharacterDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    const { instruction } = c.req.valid('json');

    try {
      const row = await service.editCharacterWithInstruction(id, instruction);
      return c.json(row);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Character not found' }, 404);
      }
      throw err;
    }
  },
);

// POST /api/settings/:id/edit - 設定をLLMで編集
llmEditRouter.post(
  '/settings/:id/edit',
  zValidator('param', idParamSchema),
  zValidator('json', editInstructionSchema),
  async (c) => {
    const service = new SettingDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    const { instruction } = c.req.valid('json');

    try {
      const row = await service.editSettingWithInstruction(id, instruction);
      return c.json(row);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Setting not found' }, 404);
      }
      throw err;
    }
  },
);

// POST /api/novels/:novelId/settings/draft - 設定ドラフトをLLMで生成（DB書き込みなし）
llmEditRouter.post(
  '/novels/:novelId/settings/draft',
  zValidator('param', novelIdParamSchema),
  zValidator('json', settingDraftSchema),
  async (c) => {
    const service = new SettingDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { instruction, currentDraft } = c.req.valid('json');
    const category = currentDraft?.category ?? '';
    const result = await service.generateDraft(instruction, category);
    return c.json(result);
  },
);

export default llmEditRouter;
