import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppContext } from "../../context.js";
import { getServices } from "../../core/services.js";
import {
  createTimelineSchema,
  idParamSchema,
  saveTimelinesMarkdownSchema,
} from "../../schemas/index.js";

export const novelTimelinesRouter = new Hono<AppContext>()
  // GET /api/novels/:id/timelines - 時系列一覧
  .get("/:id/timelines", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const rows = await getServices(c).timeline.listTimelines(id);
    return c.json(rows);
  })
  // POST /api/novels/:id/timelines - 時系列作成
  .post(
    "/:id/timelines",
    zValidator("param", idParamSchema),
    zValidator("json", createTimelineSchema),
    async (c) => {
      const { id: novelId } = c.req.valid("param");
      const body = c.req.valid("json");
      const row = await getServices(c).timeline.createTimeline({
        event: body.event,
        novelId,
        order: body.order,
        sectionId: body.sectionId || null,
        timestamp: body.timestamp || null,
      });
      return c.json(row, 201);
    }
  )
  // GET /api/novels/:id/timelines/markdown - 年表マークダウン取得
  .get(
    "/:id/timelines/markdown",
    zValidator("param", idParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const markdown = await getServices(c).timeline.getMarkdown(id);
      return c.json({ markdown });
    }
  )
  // POST /api/novels/:id/timelines/markdown - 年表マークダウン一括保存
  .post(
    "/:id/timelines/markdown",
    zValidator("param", idParamSchema),
    zValidator("json", saveTimelinesMarkdownSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { markdown } = c.req.valid("json");
      const result = await getServices(c).timeline.saveMarkdown(id, markdown);
      return c.json({
        created: result.createdCount,
        deleted: result.deletedCount,
        updated: result.updatedCount,
      });
    }
  );
