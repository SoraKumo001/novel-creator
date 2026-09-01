import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppContext } from "../../context.js";
import { getServices } from "../../core/services.js";
import {
  createForeshadowingSchema,
  editForeshadowingDocumentSchema,
  editForeshadowingSectionSchema,
  foreshadowingDraftSchema,
  idParamSchema,
  saveForeshadowingsMarkdownSchema,
} from "../../schemas/index.js";

export const novelForeshadowingsRouter = new Hono<AppContext>()
  // GET /api/novels/:id/foreshadowings - 伏線一覧
  .get("/:id/foreshadowings", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const rows =
      await getServices(c).foreshadowing.getForeshadowingsByNovel(id);
    return c.json(rows);
  })
  // POST /api/novels/:id/foreshadowings - 伏線作成
  .post(
    "/:id/foreshadowings",
    zValidator("param", idParamSchema),
    zValidator("json", createForeshadowingSchema),
    async (c) => {
      const { id: novelId } = c.req.valid("param");
      const body = c.req.valid("json");
      const row = await getServices(c).foreshadowing.createForeshadowing(
        novelId,
        {
          category: body.category ?? "未分類",
          description: body.description ?? null,
          placedSectionId: body.placedSectionId ?? null,
          resolvedSectionId: body.resolvedSectionId ?? null,
          status: body.status ?? "unresolved",
          title: body.title,
        }
      );
      return c.json(row, 201);
    }
  )
  // POST /api/novels/:id/foreshadowings/draft - 伏線ドラフト生成
  .post(
    "/:id/foreshadowings/draft",
    zValidator("param", idParamSchema),
    zValidator("json", foreshadowingDraftSchema),
    async (c) => {
      const { instruction, currentDraft } = c.req.valid("json");
      const result = await getServices(c).foreshadowing.generateDraft(
        instruction,
        currentDraft
      );
      return c.json(result);
    }
  )
  // GET /api/novels/:id/foreshadowings/markdown - 伏線マークダウン取得
  .get(
    "/:id/foreshadowings/markdown",
    zValidator("param", idParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const markdown = await getServices(c).foreshadowing.getMarkdown(id);
      return c.json({ markdown });
    }
  )
  // POST /api/novels/:id/foreshadowings/markdown - 伏線マークダウン一括保存
  .post(
    "/:id/foreshadowings/markdown",
    zValidator("param", idParamSchema),
    zValidator("json", saveForeshadowingsMarkdownSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { markdown } = c.req.valid("json");
      const result = await getServices(c).foreshadowing.saveMarkdown(
        id,
        markdown
      );
      return c.json({
        created: result.created,
        deleted: result.deleted,
        duplicateCount: 0,
        updated: result.updated,
      });
    }
  )
  // POST /api/novels/:id/foreshadowings/edit-section - 伏線セクションLLM編集
  .post(
    "/:id/foreshadowings/edit-section",
    zValidator("param", idParamSchema),
    zValidator("json", editForeshadowingSectionSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await getServices(
        c
      ).foreshadowing.editForeshadowingSection(
        id,
        {
          category: body.category,
          description: body.description,
          status: body.status,
          title: body.title,
        },
        body.instruction
      );
      return c.json({ markdown: result.body });
    }
  )
  // POST /api/novels/:id/foreshadowings/edit-document - 伏線マークダウン全体LLM編集
  .post(
    "/:id/foreshadowings/edit-document",
    zValidator("param", idParamSchema),
    zValidator("json", editForeshadowingDocumentSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { instruction } = c.req.valid("json");
      const result = await getServices(
        c
      ).foreshadowing.editForeshadowingDocument(id, instruction);
      return c.json({ markdown: result.markdown });
    }
  );
