import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppContext } from '../../context.js';
import { getServices } from '../../core/services.js';
import {
  createCharacterSchema,
  editCharacterDocumentSchema,
  editCharacterSectionSchema,
  idParamSchema,
  saveCharactersMarkdownSchema,
} from '../../schemas/index.js';

export const novelCharactersRouter = new Hono<AppContext>()
  // GET /api/novels/:id/characters - 人物一覧
  .get('/:id/characters', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const rows = await getServices(c).character.listCharacters(id);
    return c.json(rows);
  })
  // POST /api/novels/:id/characters - 人物作成
  .post(
    '/:id/characters',
    zValidator('param', idParamSchema),
    zValidator('json', createCharacterSchema),
    async (c) => {
      const { id: novelId } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await getServices(c).character.createCharacter({
        novelId,
        category: body.category ?? '主要人物',
        name: body.name,
        description: body.description ?? null,
        traits: body.traits ?? [],
        relationships: (body.relationships as Record<string, unknown>) ?? {},
      });
      return c.json(row, 201);
    },
  )
  // GET /api/novels/:id/characters/markdown - 人物マークダウン取得
  .get('/:id/characters/markdown', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const markdown = await getServices(c).character.getMarkdown(id);
    return c.json({ markdown });
  })
  // POST /api/novels/:id/characters/markdown - 人物マークダウン一括保存
  .post(
    '/:id/characters/markdown',
    zValidator('param', idParamSchema),
    zValidator('json', saveCharactersMarkdownSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { markdown } = c.req.valid('json');
      const result = await getServices(c).character.saveMarkdown(id, markdown);
      return c.json({
        created: result.createdCount,
        updated: result.updatedCount,
        deleted: result.deletedCount,
        duplicateCount: 0,
      });
    },
  )
  // POST /api/novels/:id/characters/edit-section - 人物セクションLLM編集
  .post(
    '/:id/characters/edit-section',
    zValidator('param', idParamSchema),
    zValidator('json', editCharacterSectionSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const parsedSummary = await getServices(c).character.editCharacterSection({
        novelId: id,
        category: body.category,
        name: body.name,
        description: body.description,
        traits: body.traits,
        relationships: body.relationships,
        instruction: body.instruction,
      });
      return c.json({ markdown: parsedSummary ?? '' });
    },
  )
  // POST /api/novels/:id/characters/edit-document - 人物マークダウン全体LLM編集
  .post(
    '/:id/characters/edit-document',
    zValidator('param', idParamSchema),
    zValidator('json', editCharacterDocumentSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { markdown, instruction } = c.req.valid('json');
      const parsedSummary = await getServices(c).character.editCharacterDocument(
        id,
        markdown,
        instruction,
      );
      return c.json({ markdown: parsedSummary ?? '' });
    },
  );
