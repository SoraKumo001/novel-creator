import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import type { AppContext } from "../context.js";
import { getServices } from "../core/services.js";
import { assertNovelAccess, resolveNovelId } from "../middleware/auth.js";
import {
  createCustomPromptSchema,
  idParamSchema,
  listCustomPromptsQuerySchema,
  updateCustomPromptSchema,
} from "../schemas/index.js";

/**
 * null 小説（全体共有）の読み取りは全認証ユーザー可、書き込みは admin のみ。
 * 小説紐付きの読み書きは所有者（owner-or-admin）チェックを行う。
 * ユーザー未格納時（ルーター単体テスト）は素通りする。
 */
async function assertPromptWrite(
  c: Context<AppContext>,
  novelId: string | null | undefined
): Promise<Response | null> {
  const current = c.get("user");
  if (!current) {
    return null;
  }
  if (!novelId) {
    if (current.role !== "admin") {
      return c.json(
        { error: { code: "FORBIDDEN", message: "Admin only" } },
        403
      );
    }
    return null;
  }
  return assertNovelAccess(c, novelId);
}

const customPromptsRouter = new Hono<AppContext>()
  // GET /api/custom-prompts - カスタムプロンプト一覧取得
  .get("/", zValidator("query", listCustomPromptsQuerySchema), async (c) => {
    const { novelId, category } = c.req.valid("query");
    if (novelId) {
      const denied = await assertNovelAccess(c, novelId);
      if (denied) {
        return denied;
      }
    }
    const rows = await getServices(c).customPrompt.listPrompts(
      novelId,
      category
    );
    return c.json(rows);
  })
  // POST /api/custom-prompts - 新規作成
  .post("/", zValidator("json", createCustomPromptSchema), async (c) => {
    const body = c.req.valid("json");
    const denied = await assertPromptWrite(c, body.novelId);
    if (denied) {
      return denied;
    }
    const row = await getServices(c).customPrompt.createPrompt(body);
    return c.json(row, 201);
  })
  // GET /api/custom-prompts/:id - 詳細取得
  // null 小説（全体共有）の読み取りは全認証ユーザー可のため、
  // 小説紐付きの場合のみ所有チェックする。
  .get("/:id", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const current = c.get("user");
    if (current) {
      const novelId = await resolveNovelId(c.get("db"), "customPrompt", id);
      if (novelId) {
        const denied = await assertNovelAccess(c, novelId);
        if (denied) {
          return denied;
        }
      }
    }
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
      const denied = await assertPromptWrite(
        c,
        await resolveNovelId(c.get("db"), "customPrompt", id)
      );
      if (denied) {
        return denied;
      }
      const body = c.req.valid("json");
      const row = await getServices(c).customPrompt.updatePrompt(id, body);
      return c.json(row);
    }
  )
  // DELETE /api/custom-prompts/:id - 削除
  .delete("/:id", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const denied = await assertPromptWrite(
      c,
      await resolveNovelId(c.get("db"), "customPrompt", id)
    );
    if (denied) {
      return denied;
    }
    const row = await getServices(c).customPrompt.deletePrompt(id);
    return c.json(row);
  })
  // POST /api/custom-prompts/seed - デフォルトプリセットを再シード
  .post("/seed", async (c) => {
    const denied = await assertPromptWrite(c, null);
    if (denied) {
      return denied;
    }
    const rows = await getServices(c).customPrompt.seedDefaultPresets();
    return c.json(rows);
  });

export { customPromptsRouter };
