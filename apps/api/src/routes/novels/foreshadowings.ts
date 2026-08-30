import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppContext } from '../../context.js';
import { getServices } from '../../core/services.js';
import {
  createForeshadowingSchema,
  editForeshadowingDocumentSchema,
  editForeshadowingSectionSchema,
  foreshadowingDraftSchema,
  idParamSchema,
  saveForeshadowingsMarkdownSchema,
} from '../../schemas/index.js';

export const novelForeshadowingsRouter = new Hono<AppContext>()
  // GET /api/novels/:id/foreshadowings - 伏線一覧
  .get('/:id/foreshadowings', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const rows = await getServices(c).foreshadowing.getForeshadowingsByNovel(id);
    return c.json(rows);
  })
  // POST /api/novels/:id/foreshadowings - 伏線作成
  .post(
    '/:id/foreshadowings',
    zValidator('param', idParamSchema),
    zValidator('json', createForeshadowingSchema),
    async (c) => {
      const { id: novelId } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await getServices(c).foreshadowing.createForeshadowing(novelId, {
        title: body.title,
        category: body.category ?? '未分類',
        description: body.description ?? null,
        status: body.status ?? 'unresolved',
        placedSectionId: body.placedSectionId ?? null,
        resolvedSectionId: body.resolvedSectionId ?? null,
      });
      return c.json(row, 201);
    },
  )
  // POST /api/novels/:id/foreshadowings/draft - 伏線ドラフト生成
  .post(
    '/:id/foreshadowings/draft',
    zValidator('param', idParamSchema),
    zValidator('json', foreshadowingDraftSchema),
    async (c) => {
      const { instruction, currentDraft } = c.req.valid('json');
      const result = await getServices(c).foreshadowing.generateDraft(instruction, currentDraft);
      return c.json(result);
    },
  )
  // GET /api/novels/:id/foreshadowings/markdown - 伏線マークダウン取得
  .get('/:id/foreshadowings/markdown', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const markdown = await getServices(c).foreshadowing.getMarkdown(id);
    return c.json({ markdown });
  })
  // POST /api/novels/:id/foreshadowings/markdown - 伏線マークダウン一括保存
  .post(
    '/:id/foreshadowings/markdown',
    zValidator('param', idParamSchema),
    zValidator('json', saveForeshadowingsMarkdownSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { markdown } = c.req.valid('json');
      const result = await getServices(c).foreshadowing.saveMarkdown(id, markdown);
      return c.json({
        created: result.created,
        updated: result.updated,
        deleted: result.deleted,
        duplicateCount: 0,
      });
    },
  )
  // POST /api/novels/:id/foreshadowings/edit-section - 伏線セクションLLM編集
  .post(
    '/:id/foreshadowings/edit-section',
    zValidator('param', idParamSchema),
    zValidator('json', editForeshadowingSectionSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const result = await getServices(c).foreshadowing.editForeshadowingSection(
        id,
        {
          category: body.category,
          title: body.title,
          description: body.description,
          status: body.status,
        },
        body.instruction,
      );
      return c.json({ markdown: result.body });
    },
  )
  // POST /api/novels/:id/foreshadowings/edit-document - 伏線マークダウン全体LLM編集
  .post(
    '/:id/foreshadowings/edit-document',
    zValidator('param', idParamSchema),
    zValidator('json', editForeshadowingDocumentSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { instruction } = c.req.valid('json');
      const result = await getServices(c).foreshadowing.editForeshadowingDocument(id, instruction);
      return c.json({ markdown: result.markdown });
    },
  );
