import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppContext } from '../context.js';
import { getServices } from '../core/services.js';
import {
  createLlmConfigSchema,
  idParamSchema,
  testLlmConfigSchema,
  updateLlmConfigSchema,
} from '../schemas/index.js';

const llmConfigsRouter = new Hono<AppContext>()
  // GET /api/llm-configs - 設定一覧取得
  .get('/', async (c) => {
    const rows = await getServices(c).llmConfig.listConfigs();
    return c.json(rows);
  })
  // POST /api/llm-configs - 設定新規作成
  .post('/', zValidator('json', createLlmConfigSchema), async (c) => {
    const body = c.req.valid('json');
    const row = await getServices(c).llmConfig.createConfig({
      name: body.name,
      provider: body.provider,
      modelId: body.modelId,
      baseUrl: body.baseUrl || null,
      apiKey: body.apiKey || null,
      isDefault: body.isDefault ?? false,
      description: body.description || null,
    });
    return c.json(row, 201);
  })
  // POST /api/llm-configs/test - 接続テスト
  .post('/test', zValidator('json', testLlmConfigSchema), async (c) => {
    const body = c.req.valid('json');
    const result = await getServices(c).llmConfig.testConfig({
      provider: body.provider,
      modelId: body.modelId,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
    });
    return c.json(result);
  })
  // GET /api/llm-configs/:id - 設定詳細取得
  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const row = await getServices(c).llmConfig.getConfig(id);
    return c.json(row);
  })
  // PUT /api/llm-configs/:id - 設定更新
  .put(
    '/:id',
    zValidator('param', idParamSchema),
    zValidator('json', updateLlmConfigSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await getServices(c).llmConfig.updateConfig(id, {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.provider !== undefined ? { provider: body.provider } : {}),
        ...(body.modelId !== undefined ? { modelId: body.modelId } : {}),
        ...(body.baseUrl !== undefined ? { baseUrl: body.baseUrl } : {}),
        ...(body.apiKey !== undefined ? { apiKey: body.apiKey } : {}),
        ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
      });
      return c.json(row);
    },
  )
  // DELETE /api/llm-configs/:id - 設定削除
  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    await getServices(c).llmConfig.deleteConfig(id);
    return c.json({ success: true });
  })
  // POST /api/llm-configs/:id/set-default - デフォルトに設定
  .post('/:id/set-default', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const row = await getServices(c).llmConfig.setDefault(id);
    return c.json(row);
  });

export default llmConfigsRouter;
