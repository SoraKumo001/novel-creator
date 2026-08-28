import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { AppContext } from '../context.js';
import { CharacterDomainService, NotFoundError } from '../core/index.js';
import { editInstructionSchema, idParamSchema, updateCharacterSchema } from '../schemas/index.js';

const charactersRouter = new Hono<AppContext>()
  // GET /api/characters/:id - 人物個別取得
  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const service = new CharacterDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    try {
      const character = await service.getCharacter(id);
      return c.json(character);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Character not found' }, 404);
      }
      throw err;
    }
  })
  // PUT /api/characters/:id - 人物更新
  .put(
    '/:id',
    zValidator('param', idParamSchema),
    zValidator('json', updateCharacterSchema),
    async (c) => {
      const service = new CharacterDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');

      try {
        const row = await service.updateCharacter(id, {
          category: body.category,
          name: body.name,
          description: body.description,
          traits: body.traits,
          relationships: body.relationships as Record<string, unknown>,
        });
        return c.json(row);
      } catch (err) {
        if (err instanceof NotFoundError) {
          return c.json({ error: 'Character not found' }, 404);
        }
        throw err;
      }
    },
  )
  // DELETE /api/characters/:id - 人物削除
  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const service = new CharacterDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    try {
      await service.deleteCharacter(id);
      return c.json({ success: true });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Character not found' }, 404);
      }
      throw err;
    }
  })
  // POST /api/characters/:id/edit - LLM による個別人物編集
  .post(
    '/:id/edit',
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

export default charactersRouter;
