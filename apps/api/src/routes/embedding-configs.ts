import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppContext } from "../context.js";
import { getServices } from "../core/services.js";
import {
  createEmbeddingConfigSchema,
  idParamSchema,
  testEmbeddingConfigSchema,
  updateEmbeddingConfigSchema,
} from "../schemas/index.js";

const embeddingConfigsRouter = new Hono<AppContext>()
  // GET /api/embedding-configs - 設定一覧取得
  .get("/", async (c) => {
    const rows = await getServices(c).embeddingConfig.listConfigs();
    return c.json(rows);
  })
  // POST /api/embedding-configs - 設定新規作成
  .post("/", zValidator("json", createEmbeddingConfigSchema), async (c) => {
    const body = c.req.valid("json");
    const row = await getServices(c).embeddingConfig.createConfig({
      apiKey: body.apiKey || null,
      baseUrl: body.baseUrl || null,
      description: body.description || null,
      dimensions: body.dimensions ?? 1536,
      isDefault: body.isDefault ?? false,
      modelId: body.modelId,
      name: body.name,
      provider: body.provider,
    });
    return c.json(row, 201);
  })
  // POST /api/embedding-configs/test - 接続テスト
  .post("/test", zValidator("json", testEmbeddingConfigSchema), async (c) => {
    const body = c.req.valid("json");
    const result = await getServices(c).embeddingConfig.testConfig({
      apiKey: body.apiKey,
      baseUrl: body.baseUrl,
      dimensions: body.dimensions,
      modelId: body.modelId,
      provider: body.provider,
    });
    return c.json(result);
  })
  // GET /api/embedding-configs/:id - 設定詳細取得
  .get("/:id", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const row = await getServices(c).embeddingConfig.getConfig(id);
    return c.json(row);
  })
  // PUT /api/embedding-configs/:id - 設定更新
  .put(
    "/:id",
    zValidator("param", idParamSchema),
    zValidator("json", updateEmbeddingConfigSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const row = await getServices(c).embeddingConfig.updateConfig(id, {
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.provider === undefined ? {} : { provider: body.provider }),
        ...(body.modelId === undefined ? {} : { modelId: body.modelId }),
        ...(body.dimensions === undefined
          ? {}
          : { dimensions: body.dimensions }),
        ...(body.baseUrl === undefined ? {} : { baseUrl: body.baseUrl }),
        ...(body.apiKey === undefined ? {} : { apiKey: body.apiKey }),
        ...(body.isDefault === undefined ? {} : { isDefault: body.isDefault }),
        ...(body.description === undefined
          ? {}
          : { description: body.description }),
      });
      return c.json(row);
    }
  )
  // DELETE /api/embedding-configs/:id - 設定削除
  .delete("/:id", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    await getServices(c).embeddingConfig.deleteConfig(id);
    return c.json({ success: true });
  })
  // POST /api/embedding-configs/:id/set-default - デフォルトに設定
  .post("/:id/set-default", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const row = await getServices(c).embeddingConfig.setDefault(id);
    return c.json(row);
  });

export default embeddingConfigsRouter;
