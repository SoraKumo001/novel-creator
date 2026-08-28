import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppContext } from '../context.js';
import { getServices } from '../core/services.js';
import { editInstructionSchema, idParamSchema, updateSettingSchema } from '../schemas/index.js';

const settingsRouter = new Hono<AppContext>()
  // GET /api/settings/:id - 設定個別取得
  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const setting = await getServices(c).setting.getSetting(id);
    return c.json(setting);
  })
  // PUT /api/settings/:id - 設定更新
  .put(
    '/:id',
    zValidator('param', idParamSchema),
    zValidator('json', updateSettingSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await getServices(c).setting.updateSetting(id, {
        category: body.category,
        name: body.name,
        description: body.description,
        metadata: body.metadata as Record<string, unknown>,
      });
      return c.json(row);
    },
  )
  // DELETE /api/settings/:id - 設定削除
  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    await getServices(c).setting.deleteSetting(id);
    return c.json({ success: true });
  })
  // POST /api/settings/:id/edit - LLM による個別設定編集
  .post(
    '/:id/edit',
    zValidator('param', idParamSchema),
    zValidator('json', editInstructionSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { instruction } = c.req.valid('json');
      const row = await getServices(c).setting.editSettingWithInstruction(id, instruction);
      return c.json(row);
    },
  );

export default settingsRouter;
