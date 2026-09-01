import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppContext } from "../context.js";
import { getServices } from "../core/services.js";
import {
  createCustomPromptSchema,
  idParamSchema,
  listCustomPromptsQuerySchema,
  updateCustomPromptSchema,
} from "../schemas/index.js";

const customPromptsRouter = new Hono<AppContext>()
  // GET /api/custom-prompts - カスタムプロンプト一覧取得
  .get("/", zValidator("query", listCustomPromptsQuerySchema), async (c) => {
    const { novelId, category } = c.req.valid("query");
    const rows = await getServices(c).customPrompt.listPrompts(
      novelId,
      category
    );
    return c.json(rows);
  })
  // POST /api/custom-prompts - 新規作成
  .post("/", zValidator("json", createCustomPromptSchema), async (c) => {
    const body = c.req.valid("json");
    const row = await getServices(c).customPrompt.createPrompt(body);
    return c.json(row, 201);
  })
  // GET /api/custom-prompts/:id - 詳細取得
  .get("/:id", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const row = await getServices(c).customPrompt.getPromptById(id);
    return c.json(row);
  })
  // PUT /api/custom-prompts/:id - 更新
  .put(
    "/:id",
    zValidator("param", idParamSchema),
    zValidator("json", updateCustomPromptSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const row = await getServices(c).customPrompt.updatePrompt(id, body);
      return c.json(row);
    }
  )
  // DELETE /api/custom-prompts/:id - 削除
  .delete("/:id", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const row = await getServices(c).customPrompt.deletePrompt(id);
    return c.json(row);
  })
  // POST /api/custom-prompts/seed - デフォルトプリセットを再シード
  .post("/seed", async (c) => {
    const rows = await getServices(c).customPrompt.seedDefaultPresets();
    return c.json(rows);
  });

export { customPromptsRouter };
