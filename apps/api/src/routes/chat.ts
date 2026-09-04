import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import type { AppContext } from "../context.js";
import { getServices } from "../core/services.js";
import { assertNovelAccess, resolveNovelId } from "../middleware/auth.js";
import {
  chatRequestSchema,
  createChatSessionSchema,
  extractChatEntitiesSchema,
  idParamSchema,
  updateChatSessionSchema,
} from "../schemas/index.js";

const chatRouter = new Hono<AppContext>()
  // POST /api/chat - 創作相談チャットストリーミング（AI SDK UI Message Stream）
  .post("/", zValidator("json", chatRequestSchema), async (c) => {
    const { sessionId, novelId, messages, modelConfigId } = c.req.valid("json");
    const current = c.get("user");
    // modelConfigId の指定は admin 限定（所有チェックは解決後の小説で行う）。
    if (modelConfigId && current && current.role !== "admin") {
      return c.json(
        { error: { code: "FORBIDDEN", message: "Admin only" } },
        403
      );
    }
    if (current) {
      // body の novelId はヒント扱いとし、セッションの novelId を DB から再解決して突合する。
      const resolved = await resolveNovelId(
        c.get("db"),
        "chatSession",
        sessionId
      );
      const effective = novelId ?? resolved;
      if (novelId && resolved && novelId !== resolved) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "novelId does not match session",
            },
          },
          400
        );
      }
      const denied = await assertNovelAccess(c, effective);
      if (denied) {
        return denied;
      }
    }
    return getServices(c).chat.streamCreativeChat({
      messages,
      modelConfigId,
      novelId,
      sessionId,
    });
  })

  // POST /api/chat/extract-entities - チャットテキストから人物・設定を抽出
  .post(
    "/extract-entities",
    zValidator("json", extractChatEntitiesSchema),
    async (c) => {
      const { text } = c.req.valid("json");
      const result = await getServices(c).chat.extractEntities(text);
      return c.json(result);
    }
  )
  // GET /api/chat/sessions - セッション一覧取得
  // null 小説の全件返却は禁止する（認証時は novelId 必須）。
  .get("/sessions", async (c) => {
    const novelId = c.req.query("novelId");
    const current = c.get("user");
    if (current && !novelId) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "novelId is required",
          },
        },
        400
      );
    }
    if (novelId) {
      const denied = await assertNovelAccess(c, novelId);
      if (denied) {
        return denied;
      }
    }
    const rows = await getServices(c).chat.listChatSessions(
      novelId || undefined
    );
    return c.json(rows);
  })
  // POST /api/chat/sessions - セッション新規作成
  // null 小説のセッション作成は禁止する（認証時は novelId 必須）。
  .post("/sessions", zValidator("json", createChatSessionSchema), async (c) => {
    const body = c.req.valid("json");
    const current = c.get("user");
    if (current && !body.novelId) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "novelId is required",
          },
        },
        400
      );
    }
    if (body.novelId) {
      const denied = await assertNovelAccess(c, body.novelId);
      if (denied) {
        return denied;
      }
    }
    const session = await getServices(c).chat.createChatSession({
      novelId: body.novelId || null,
      title: body.title,
    });
    return c.json(session, 201);
  })
  // GET /api/chat/sessions/:id - セッション詳細取得
  .get("/sessions/:id", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const current = c.get("user");
    if (current) {
      const denied = await assertNovelAccess(
        c,
        await resolveNovelId(c.get("db"), "chatSession", id)
      );
      if (denied) {
        return denied;
      }
    }
    const result = await getServices(c).chat.getChatSessionWithMessages(id);
    return c.json({
      ...result.session,
      messages: result.messages,
    });
  })
  // PUT /api/chat/sessions/:id - セッション更新
  .put(
    "/sessions/:id",
    zValidator("param", idParamSchema),
    zValidator("json", updateChatSessionSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const current = c.get("user");
      if (current) {
        const denied = await assertNovelAccess(
          c,
          await resolveNovelId(c.get("db"), "chatSession", id)
        );
        if (denied) {
          return denied;
        }
      }
      const body = c.req.valid("json");
      const updated = await getServices(c).chat.updateChatSession(id, body);
      return c.json(updated);
    }
  )
  // DELETE /api/chat/sessions/:id - セッション削除
  .delete("/sessions/:id", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const current = c.get("user");
    if (current) {
      const denied = await assertNovelAccess(
        c,
        await resolveNovelId(c.get("db"), "chatSession", id)
      );
      if (denied) {
        return denied;
      }
    }
    await getServices(c).chat.deleteChatSession(id);
    return c.json({ success: true });
  });

export default chatRouter;
