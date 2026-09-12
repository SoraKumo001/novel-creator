import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppContext } from "../../context.js";
import { getServices } from "../../core/services.js";
import { assertNovelAccess, resolveNovelId } from "../../middleware/auth.js";
import {
  createGlossarySchema,
  idParamSchema,
  novelGlossaryEntryParamsSchema,
  updateGlossarySchema,
} from "../../schemas/index.js";

export const novelGlossaryRouter = new Hono<AppContext>()
  // GET /api/novels/:id/glossary - 用語集一覧
  .get("/:id/glossary", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const denied = await assertNovelAccess(c, id);
    if (denied) {
      return denied;
    }
    const rows = await getServices(c).glossary.listGlossary(id);
    return c.json(rows);
  })
  // POST /api/novels/:id/glossary - 用語集作成
  .post(
    "/:id/glossary",
    zValidator("param", idParamSchema),
    zValidator("json", createGlossarySchema),
    async (c) => {
      const { id: novelId } = c.req.valid("param");
      const denied = await assertNovelAccess(c, novelId);
      if (denied) {
        return denied;
      }
      const body = c.req.valid("json");
      const row = await getServices(c).glossary.createGlossary({
        aliases: body.aliases ?? [],
        category: body.category ?? "未分類",
        description: body.description ?? null,
        novelId,
        reading: body.reading ?? null,
        term: body.term,
      });
      return c.json(row, 201);
    }
  )
  // PATCH /api/novels/:id/glossary/:entryId - 用語集更新
  .patch(
    "/:id/glossary/:entryId",
    zValidator("param", novelGlossaryEntryParamsSchema),
    zValidator("json", updateGlossarySchema),
    async (c) => {
      const { entryId, id: novelId } = c.req.valid("param");
      const denied = await assertNovelAccess(c, novelId);
      if (denied) {
        return denied;
      }
      const ownerNovelId = await resolveNovelId(
        c.get("db"),
        "glossary",
        entryId
      );
      if (!ownerNovelId || ownerNovelId !== novelId) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "Glossary entry not found" } },
          404
        );
      }
      const body = c.req.valid("json");
      const row = await getServices(c).glossary.updateGlossary(entryId, {
        aliases: body.aliases,
        category: body.category,
        description: body.description,
        reading: body.reading,
        term: body.term,
      });
      return c.json(row);
    }
  )
  // DELETE /api/novels/:id/glossary/:entryId - 用語集削除
  .delete(
    "/:id/glossary/:entryId",
    zValidator("param", novelGlossaryEntryParamsSchema),
    async (c) => {
      const { entryId, id: novelId } = c.req.valid("param");
      const denied = await assertNovelAccess(c, novelId);
      if (denied) {
        return denied;
      }
      const ownerNovelId = await resolveNovelId(
        c.get("db"),
        "glossary",
        entryId
      );
      if (!ownerNovelId || ownerNovelId !== novelId) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "Glossary entry not found" } },
          404
        );
      }
      await getServices(c).glossary.deleteGlossary(entryId);
      return c.json({ ok: true });
    }
  );
