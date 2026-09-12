import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import type { AppContext } from "../context.js";
import { getServices } from "../core/services.js";
import { assertNovelAccess, resolveNovelId } from "../middleware/auth.js";
import { idParamSchema, updateContentSchema } from "../schemas/index.js";

const contentsRouter = new Hono<AppContext>()
  // GET /api/contents/:id - 本文取得（sectionId 指定）
  .get("/:id", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const novelId = await resolveNovelId(c.get("db"), "section", id);
    const denied = await assertNovelAccess(c, novelId);
    if (denied) {
      return denied;
    }
    const row = await getServices(c).content.getContent(id);
    return c.json(row);
  })
  // PUT /api/contents/:id - 本文更新（sectionId 指定）
  .put(
    "/:id",
    zValidator("param", idParamSchema),
    zValidator("json", updateContentSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const novelId = await resolveNovelId(c.get("db"), "section", id);
      const denied = await assertNovelAccess(c, novelId);
      if (denied) {
        return denied;
      }
      const body = c.req.valid("json");
      const row = await getServices(c).content.updateContent(
        id,
        body.body,
        "手動保存",
        { expectedUpdatedAt: body.updatedAt }
      );
      return c.json(row);
    }
  );

export default contentsRouter;
