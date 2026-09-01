import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { getServices } from "../../core/services.js";
import {
  createSettingSchema,
  editSettingDocumentSchema,
  editSettingSectionSchema,
  idParamSchema,
  saveSettingsMarkdownSchema,
  settingDraftSchema,
} from "../../schemas/index.js";

export const novelSettingsRouter = new Hono<AppContext>()
  // GET /api/novels/:id/settings - 設定一覧
  .get(
    "/:id/settings",
    zValidator("param", idParamSchema),
    zValidator("query", z.object({ category: z.string().optional() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const { category } = c.req.valid("query");
      const rows = await getServices(c).setting.listSettings(id, category);
      return c.json(rows);
    }
  )
  // POST /api/novels/:id/settings - 設定作成
  .post(
    "/:id/settings",
    zValidator("param", idParamSchema),
    zValidator("json", createSettingSchema),
    async (c) => {
      const { id: novelId } = c.req.valid("param");
      const body = c.req.valid("json");
      const row = await getServices(c).setting.createSetting({
        category: body.category,
        description: body.description ?? null,
        metadata: (body.metadata as Record<string, unknown>) ?? {},
        name: body.name,
        novelId,
      });
      return c.json(row, 201);
    }
  )
  // POST /api/novels/:id/settings/draft - 設定ドラフト生成
  .post(
    "/:id/settings/draft",
    zValidator("param", idParamSchema),
    zValidator("json", settingDraftSchema),
    async (c) => {
      const { instruction, currentDraft } = c.req.valid("json");
      const result = await getServices(c).setting.generateDraft(
        instruction,
        currentDraft
      );
      return c.json(result);
    }
  )
  // GET /api/novels/:id/settings/markdown - 設定マークダウン取得
  .get(
    "/:id/settings/markdown",
    zValidator("param", idParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const markdown = await getServices(c).setting.getMarkdown(id);
      return c.json({ markdown });
    }
  )
  // POST /api/novels/:id/settings/markdown - 設定マークダウン一括保存
  .post(
    "/:id/settings/markdown",
    zValidator("param", idParamSchema),
    zValidator("json", saveSettingsMarkdownSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { markdown } = c.req.valid("json");
      const result = await getServices(c).setting.saveMarkdown(id, markdown);
      return c.json({
        created: result.createdCount,
        deleted: result.deletedCount,
        duplicateCount: 0,
        updated: result.updatedCount,
      });
    }
  )
  // POST /api/novels/:id/settings/edit-section - 設定セクションLLM編集
  .post(
    "/:id/settings/edit-section",
    zValidator("param", idParamSchema),
    zValidator("json", editSettingSectionSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const parsedSummary = await getServices(c).setting.editSettingSection({
        category: body.category,
        description: body.description,
        instruction: body.instruction,
        name: body.name,
        novelId: id,
      });
      return c.json({ markdown: parsedSummary ?? "" });
    }
  )
  // POST /api/novels/:id/settings/edit-document - 設定マークダウン全体LLM編集
  .post(
    "/:id/settings/edit-document",
    zValidator("param", idParamSchema),
    zValidator("json", editSettingDocumentSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { markdown, instruction } = c.req.valid("json");
      const parsedSummary = await getServices(c).setting.editSettingDocument(
        id,
        markdown,
        instruction
      );
      return c.json({ markdown: parsedSummary ?? "" });
    }
  );
