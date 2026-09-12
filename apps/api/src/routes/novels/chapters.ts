import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppContext } from "../../context.js";
import { getServices } from "../../core/services.js";
import { assertNovelAccess } from "../../middleware/auth.js";
import {
  createChapterSchema,
  idParamSchema,
  savePlotMarkdownSchema,
} from "../../schemas/index.js";

export const novelChaptersRouter = new Hono<AppContext>()
  // GET /api/novels/:id/chapters - 章一覧
  .get("/:id/chapters", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const denied = await assertNovelAccess(c, id);
    if (denied) {
      return denied;
    }
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
      const denied = await assertNovelAccess(c, novelId);
      if (denied) {
        return denied;
      }
      const body = c.req.valid("json");
      const row = await getServices(c).chapter.createChapter({
        novelId,
        order: body.order,
        summary: body.summary,
        title: body.title,
      });
      return c.json(row, 201);
    }
  )
  // GET /api/novels/:id/chapters/markdown - プロットマークダウン取得
  .get(
    "/:id/chapters/markdown",
    zValidator("param", idParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const denied = await assertNovelAccess(c, id);
      if (denied) {
        return denied;
      }
      const markdown = await getServices(c).chapter.getMarkdown(id);
      return c.json({ markdown });
    }
  )
  // POST /api/novels/:id/chapters/markdown - プロットマークダウン一括保存
  .post(
    "/:id/chapters/markdown",
    zValidator("param", idParamSchema),
    zValidator("json", savePlotMarkdownSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const denied = await assertNovelAccess(c, id);
      if (denied) {
        return denied;
      }
      const { markdown } = c.req.valid("json");
      const result = await getServices(c).chapter.saveMarkdown(id, markdown);
      return c.json({
        created: result.createdCount,
        deleted: result.deletedCount,
        updated: result.updatedCount,
      });
    }
  );
