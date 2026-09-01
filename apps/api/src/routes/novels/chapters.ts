import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppContext } from "../../context.js";
import { getServices } from "../../core/services.js";
import { createChapterSchema, idParamSchema } from "../../schemas/index.js";

export const novelChaptersRouter = new Hono<AppContext>()
  // GET /api/novels/:id/chapters - 章一覧
  .get("/:id/chapters", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const rows = await getServices(c).chapter.listChapters(id);
    return c.json(rows);
  })
  // POST /api/novels/:id/chapters - 章作成
  .post(
    "/:id/chapters",
    zValidator("param", idParamSchema),
    zValidator("json", createChapterSchema),
    async (c) => {
      const { id: novelId } = c.req.valid("param");
      const body = c.req.valid("json");
      const row = await getServices(c).chapter.createChapter({
        novelId,
        order: body.order,
        summary: body.summary,
        title: body.title,
      });
      return c.json(row, 201);
    }
  );
