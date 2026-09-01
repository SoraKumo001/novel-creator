import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppContext } from "../context.js";
import { getServices } from "../core/services.js";
import { idParamSchema } from "../schemas/index.js";

const llmInstructionsRouter = new Hono<AppContext>()
  // DELETE /api/llm-instructions/:id - 指示履歴削除
  .delete("/:id", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    await getServices(c).llmInstruction.deleteInstruction(id);
    return c.json({ success: true });
  });

export default llmInstructionsRouter;
