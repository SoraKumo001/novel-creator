import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppContext } from '../context.js';
import { NotFoundError, SettingDomainService } from '../core/index.js';
import { editInstructionSchema, idParamSchema, updateSettingSchema } from '../schemas/index.js';

const settingsRouter = new Hono<AppContext>()
  // GET /api/settings/:id - 設定個別取得
  .get('/:id', zValidator('param', idParamSchema), async (c) => {
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
  })
  // PUT /api/settings/:id - 設定更新
  .put(
    '/:id',
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
  )
  // DELETE /api/settings/:id - 設定削除
  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
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
  })
  // POST /api/settings/:id/edit - LLM による個別設定編集
  .post(
    '/:id/edit',
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
