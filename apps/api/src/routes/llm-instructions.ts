import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import type { AppContext } from '../context.js';
import { LlmInstructionDomainService, NotFoundError, ValidationError } from '../core/index.js';
import { createLlmInstructionSchema, idParamSchema } from '../schemas/index.js';

const llmInstructionsRouter = new Hono<AppContext>();

// GET /api/novels/:id/llm-instructions - 指示履歴一覧
llmInstructionsRouter.get(
  '/novels/:id/llm-instructions',
  zValidator('param', idParamSchema),
  zValidator('query', z.object({ entityType: z.string().optional() })),
  async (c) => {
    const service = new LlmInstructionDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    const { entityType } = c.req.valid('query');
    const rows = await service.listInstructions(id, entityType);
    return c.json(rows);
  },
);

// POST /api/novels/:id/llm-instructions - 指示履歴作成
llmInstructionsRouter.post(
  '/novels/:id/llm-instructions',
  zValidator('param', idParamSchema),
  zValidator('json', createLlmInstructionSchema),
  async (c) => {
    const service = new LlmInstructionDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id: novelId } = c.req.valid('param');
    const body = c.req.valid('json');

    try {
      const row = await service.createInstruction({
        novelId,
        entityType: body.entityType,
        instruction: body.instruction,
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

// DELETE /api/llm-instructions/:id - 指示履歴削除
llmInstructionsRouter.delete(
  '/llm-instructions/:id',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = new LlmInstructionDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    try {
      await service.deleteInstruction(id);
      return c.json({ success: true });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Instruction not found' }, 404);
      }
      throw err;
    }
  },
);

export default llmInstructionsRouter;
