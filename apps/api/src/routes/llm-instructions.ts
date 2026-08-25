import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { llmInstructions } from '@novel-creator/db';

import type { AppContext } from '../context.js';
import { createLlmInstructionSchema, idParamSchema, novelIdParamSchema } from '../schemas/index.js';

const llmInstructionsRouter = new Hono<AppContext>();

// GET /api/novels/:novelId/llm-instructions - 指示履歴一覧（entityTypeでフィルタ、新着順）
llmInstructionsRouter.get(
  '/novels/:novelId/llm-instructions',
  zValidator('param', novelIdParamSchema),
  async (c) => {
    const db = c.var.db;
    const { novelId } = c.req.valid('param');
    const entityType = c.req.query('entityType');
    const rows = entityType
      ? await db
          .select()
          .from(llmInstructions)
          .where(
            and(eq(llmInstructions.novelId, novelId), eq(llmInstructions.entityType, entityType)),
          )
          .orderBy(desc(llmInstructions.createdAt))
      : await db
          .select()
          .from(llmInstructions)
          .where(eq(llmInstructions.novelId, novelId))
          .orderBy(desc(llmInstructions.createdAt));
    return c.json(rows);
  },
);

// POST /api/novels/:novelId/llm-instructions - 指示履歴を作成（重複時は既存を返す）
llmInstructionsRouter.post(
  '/novels/:novelId/llm-instructions',
  zValidator('param', novelIdParamSchema),
  zValidator('json', createLlmInstructionSchema),
  async (c) => {
    const db = c.var.db;
    const { novelId } = c.req.valid('param');
    const { entityType, instruction } = c.req.valid('json');

    // 重複チェック: 同じ novelId + entityType + instruction があれば既存を返す
    const [existing] = await db
      .select()
      .from(llmInstructions)
      .where(
        and(
          eq(llmInstructions.novelId, novelId),
          eq(llmInstructions.entityType, entityType),
          eq(llmInstructions.instruction, instruction),
        ),
      );
    if (existing) return c.json(existing);

    const [row] = await db
      .insert(llmInstructions)
      .values({ novelId, entityType, instruction })
      .returning();
    return c.json(row, 201);
  },
);

// DELETE /api/llm-instructions/:id - 指示履歴を削除
llmInstructionsRouter.delete(
  '/llm-instructions/:id',
  zValidator('param', idParamSchema),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const [row] = await db.delete(llmInstructions).where(eq(llmInstructions.id, id)).returning();
    if (!row) return c.json({ error: 'Instruction not found' }, 404);
    return c.json({ success: true });
  },
);

export default llmInstructionsRouter;
