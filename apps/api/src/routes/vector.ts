import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppContext } from "../context.js";
import { getServices } from "../core/services.js";
import { reindexBodySchema } from "../schemas/index.js";
import { streamEvents } from "../sse.js";

const vectorRouter = new Hono<AppContext>()
  // POST /api/vector/reindex - インデックス全再構築 (SSE ストリーミング)
  .post("/reindex", zValidator("json", reindexBodySchema), async (c) => {
    const body = c.req.valid("json");
    const reindexService = getServices(c).reindex;

    return streamEvents(
      c,
      async (emit) => {
        const result = await reindexService.reindexAll(
          body.embeddingConfigId,
          (progress) => {
            void emit("progress", progress);
          }
        );

        await emit("done", { done: true, result });
      },
      // reindex SSE のエラーペイロードは解析系と異なる { error } 形状を維持する
      {
        buildErrorPayload: (message) => ({
          error: message.length > 500 ? `${message.slice(0, 500)}...` : message,
        }),
      }
    );
  });

export default vectorRouter;
