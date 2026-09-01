import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import type { AppContext } from "../context.js";
import { getServices } from "../core/services.js";
import {
  editInstructionSchema,
  idParamSchema,
  updateCharacterSchema,
} from "../schemas/index.js";

const charactersRouter = new Hono<AppContext>()
  // GET /api/characters/:id - 人物個別取得
  .get("/:id", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const character = await getServices(c).character.getCharacter(id);
    return c.json(character);
  })
  // PUT /api/characters/:id - 人物更新
  .put(
    "/:id",
    zValidator("param", idParamSchema),
    zValidator("json", updateCharacterSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const row = await getServices(c).character.updateCharacter(id, {
        category: body.category,
        description: body.description,
        name: body.name,
        relationships: body.relationships as Record<string, unknown>,
        traits: body.traits,
      });
      return c.json(row);
    }
  )
  // DELETE /api/characters/:id - 人物削除
  .delete("/:id", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    await getServices(c).character.deleteCharacter(id);
    return c.json({ success: true });
  })
  // POST /api/characters/:id/edit - LLM による個別人物編集
  .post(
    "/:id/edit",
    zValidator("param", idParamSchema),
    zValidator("json", editInstructionSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { instruction } = c.req.valid("json");
      const row = await getServices(c).character.editCharacterWithInstruction(
        id,
        instruction
      );
      return c.json(row);
    }
  );

export default charactersRouter;
