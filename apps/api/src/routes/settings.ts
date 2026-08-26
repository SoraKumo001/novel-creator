import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import type { AppContext } from '../context.js';
import { NotFoundError, SettingDomainService, ValidationError } from '../core/index.js';
import {
  createSettingSchema,
  editInstructionSchema,
  idParamSchema,
  settingDraftSchema,
  updateSettingSchema,
} from '../schemas/index.js';

const settingsRouter = new Hono<AppContext>();

// GET /api/novels/:id/settings - 設定一覧
settingsRouter.get(
  '/novels/:id/settings',
  zValidator('param', idParamSchema),
  zValidator('query', z.object({ category: z.string().optional() })),
  async (c) => {
    const service = new SettingDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    const { category } = c.req.valid('query');
    const rows = await service.listSettings(id, category);
    return c.json(rows);
  },
);

// POST /api/novels/:id/settings/draft - 設定ドラフト生成
settingsRouter.post(
  '/novels/:id/settings/draft',
  zValidator('param', idParamSchema),
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

// POST /api/novels/:id/settings - 設定作成
settingsRouter.post(
  '/novels/:id/settings',
  zValidator('param', idParamSchema),
  zValidator('json', createSettingSchema),
  async (c) => {
    const service = new SettingDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id: novelId } = c.req.valid('param');
    const body = c.req.valid('json');

    try {
      const row = await service.createSetting({
        novelId,
        category: body.category,
        name: body.name,
        description: body.description ?? null,
        metadata: (body.metadata as Record<string, unknown>) ?? {},
      });
      return c.json(row, 201);
    } catch (err) {
      if (err instanceof ValidationError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }
  },
);

// GET /api/settings/:id - 設定個別取得
settingsRouter.get('/settings/:id', zValidator('param', idParamSchema), async (c) => {
  const service = new SettingDomainService({
    db: c.var.db,
    llm: c.var.llm,
    embedding: c.var.embedding,
    vectorStore: c.var.vectorStore,
    env: c.var.env,
  });
  const { id } = c.req.valid('param');
  try {
    const setting = await service.getSetting(id);
    return c.json(setting);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ error: 'Setting not found' }, 404);
    }
    throw err;
  }
});

// PUT /api/settings/:id - 設定更新
settingsRouter.put(
  '/settings/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateSettingSchema),
  async (c) => {
    const service = new SettingDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    try {
      const row = await service.updateSetting(id, {
        category: body.category,
        name: body.name,
        description: body.description,
        metadata: body.metadata as Record<string, unknown>,
      });
      return c.json(row);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Setting not found' }, 404);
      }
      throw err;
    }
  },
);

// DELETE /api/settings/:id - 設定削除
settingsRouter.delete('/settings/:id', zValidator('param', idParamSchema), async (c) => {
  const service = new SettingDomainService({
    db: c.var.db,
    llm: c.var.llm,
    embedding: c.var.embedding,
    vectorStore: c.var.vectorStore,
    env: c.var.env,
  });
  const { id } = c.req.valid('param');
  try {
    await service.deleteSetting(id);
    return c.json({ success: true });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ error: 'Setting not found' }, 404);
    }
    throw err;
  }
});

// POST /api/settings/:id/edit - LLM による個別設定編集
settingsRouter.post(
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

export default settingsRouter;
