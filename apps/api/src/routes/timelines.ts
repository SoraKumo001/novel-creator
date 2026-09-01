import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import type { AppContext } from "../context.js";
import { getServices } from "../core/services.js";
import { idParamSchema, updateTimelineSchema } from "../schemas/index.js";

const timelinesRouter = new Hono<AppContext>()
  // PUT /api/timelines/:id - 時系列更新
  .put(
    "/:id",
    zValidator("param", idParamSchema),
    zValidator("json", updateTimelineSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const row = await getServices(c).timeline.updateTimeline(id, body);
      return c.json(row);
    }
  )
  // DELETE /api/timelines/:id - 時系列削除
  .delete("/:id", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    await getServices(c).timeline.deleteTimeline(id);
    return c.json({ success: true });
  });

export default timelinesRouter;
