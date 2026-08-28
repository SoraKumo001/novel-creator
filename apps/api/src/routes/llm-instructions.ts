import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppContext } from '../context.js';
import { LlmInstructionDomainService, NotFoundError } from '../core/index.js';
import { idParamSchema } from '../schemas/index.js';

const llmInstructionsRouter = new Hono<AppContext>()
  // DELETE /api/llm-instructions/:id - 指示履歴削除
  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
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
  });

export default llmInstructionsRouter;
