import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { getServices } from "../../core/services.js";
import {
  createLlmInstructionSchema,
  idParamSchema,
} from "../../schemas/index.js";

export const novelInstructionsRouter = new Hono<AppContext>()
  // GET /api/novels/:id/llm-instructions - 指示履歴一覧
  .get(
    "/:id/llm-instructions",
    zValidator("param", idParamSchema),
    zValidator("query", z.object({ entityType: z.string().optional() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const { entityType } = c.req.valid("query");
      const rows = await getServices(c).llmInstruction.listInstructions(
        id,
        entityType
      );
      return c.json(rows);
    }
  )
  // POST /api/novels/:id/llm-instructions - 指示履歴作成
  .post(
    "/:id/llm-instructions",
    zValidator("param", idParamSchema),
    zValidator("json", createLlmInstructionSchema),
    async (c) => {
      const { id: novelId } = c.req.valid("param");
      const body = c.req.valid("json");
      const row = await getServices(c).llmInstruction.createInstruction({
        entityType: body.entityType,
        instruction: body.instruction,
        novelId,
      });
      return c.json(row, 201);
    }
  );
