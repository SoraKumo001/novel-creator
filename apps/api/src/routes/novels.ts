import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import type { AppContext } from '../context.js';
import {
  ChapterDomainService,
  CharacterDomainService,
  GenerateDomainService,
  LlmInstructionDomainService,
  NotFoundError,
  NovelDomainService,
  SettingDomainService,
  TimelineDomainService,
  ValidationError,
} from '../core/index.js';
import {
  createChapterSchema,
  createCharacterSchema,
  createLlmInstructionSchema,
  createNovelSchema,
  createSettingSchema,
  createTimelineSchema,
  editCharacterDocumentSchema,
  editCharacterSectionSchema,
  editSettingDocumentSchema,
  editSettingSectionSchema,
  idParamSchema,
  saveCharactersMarkdownSchema,
  saveSettingsMarkdownSchema,
  settingDraftSchema,
  updateNovelSchema,
} from '../schemas/index.js';

const novelsRouter = new Hono<AppContext>()
  // GET /api/novels - 一覧取得
  .get('/', async (c) => {
    const service = new NovelDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const rows = await service.listNovels();
    return c.json(rows);
  })
  // POST /api/novels - 作成
  .post('/', zValidator('json', createNovelSchema), async (c) => {
    const service = new NovelDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const body = c.req.valid('json');
    const row = await service.createNovel({
      title: body.title,
      description: body.description ?? null,
    });
    return c.json(row, 201);
  })
  // GET /api/novels/:id - 個別取得（関連データ含む）
  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const service = new NovelDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    try {
      const detail = await service.getNovelDetail(id);
      return c.json({
        ...detail.novel,
        chapters: detail.chapters,
        characters: detail.characters,
        settings: detail.settings,
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Novel not found' }, 404);
      }
      throw err;
    }
  })
  // PUT /api/novels/:id - 更新
  .put(
    '/:id',
    zValidator('param', idParamSchema),
    zValidator('json', updateNovelSchema),
    async (c) => {
      const service = new NovelDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const row = await service.updateNovel(id, body);
        return c.json(row);
      } catch (err) {
        if (err instanceof NotFoundError) {
          return c.json({ error: 'Novel not found' }, 404);
        }
        throw err;
      }
    },
  )
  // DELETE /api/novels/:id - 削除
  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const service = new NovelDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    try {
      await service.deleteNovel(id);
      return c.json({ success: true });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Novel not found' }, 404);
      }
      throw err;
    }
  })
  // GET /api/novels/:id/chapters - 章一覧
  .get('/:id/chapters', zValidator('param', idParamSchema), async (c) => {
    const service = new ChapterDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    const rows = await service.listChapters(id);
    return c.json(rows);
  })
  // POST /api/novels/:id/chapters - 章作成
  .post(
    '/:id/chapters',
    zValidator('param', idParamSchema),
    zValidator('json', createChapterSchema),
    async (c) => {
      const service = new ChapterDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id: novelId } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await service.createChapter({
        novelId,
        title: body.title,
        order: body.order,
        summary: body.summary,
      });
      return c.json(row, 201);
    },
  )
  // GET /api/novels/:id/characters - 人物一覧
  .get('/:id/characters', zValidator('param', idParamSchema), async (c) => {
    const service = new CharacterDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    const rows = await service.listCharacters(id);
    return c.json(rows);
  })
  // POST /api/novels/:id/characters - 人物作成
  .post(
    '/:id/characters',
    zValidator('param', idParamSchema),
    zValidator('json', createCharacterSchema),
    async (c) => {
      const service = new CharacterDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id: novelId } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const row = await service.createCharacter({
          novelId,
          category: body.category ?? '主要人物',
          name: body.name,
          description: body.description ?? null,
          traits: body.traits ?? [],
          relationships: (body.relationships as Record<string, unknown>) ?? {},
        });
        return c.json(row, 201);
      } catch (err) {
        if (err instanceof ValidationError) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    },
  )
  // GET /api/novels/:id/characters/markdown - 人物マークダウン取得
  .get('/:id/characters/markdown', zValidator('param', idParamSchema), async (c) => {
    const service = new CharacterDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    const markdown = await service.getMarkdown(id);
    return c.json({ markdown });
  })
  // POST /api/novels/:id/characters/markdown - 人物マークダウン一括保存
  .post(
    '/:id/characters/markdown',
    zValidator('param', idParamSchema),
    zValidator('json', saveCharactersMarkdownSchema),
    async (c) => {
      const service = new CharacterDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id } = c.req.valid('param');
      const { markdown } = c.req.valid('json');
      const result = await service.saveMarkdown(id, markdown);
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
      const service = new CharacterDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const parsedSummary = await service.editCharacterSection({
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
      const service = new CharacterDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id } = c.req.valid('param');
      const { markdown, instruction } = c.req.valid('json');
      const parsedSummary = await service.editCharacterDocument(id, markdown, instruction);
      return c.json({ markdown: parsedSummary ?? '' });
    },
  )
  // GET /api/novels/:id/settings - 設定一覧
  .get(
    '/:id/settings',
    zValidator('param', idParamSchema),
    zValidator('query', z.object({ category: z.string().optional() })),
    async (c) => {
      const service = new SettingDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id } = c.req.valid('param');
      const { category } = c.req.valid('query');
      const rows = await service.listSettings(id, category);
      return c.json(rows);
    },
  )
  // POST /api/novels/:id/settings - 設定作成
  .post(
    '/:id/settings',
    zValidator('param', idParamSchema),
    zValidator('json', createSettingSchema),
    async (c) => {
      const service = new SettingDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id: novelId } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const row = await service.createSetting({
          novelId,
          category: body.category,
          name: body.name,
          description: body.description ?? null,
          metadata: (body.metadata as Record<string, unknown>) ?? {},
        });
        return c.json(row, 201);
      } catch (err) {
        if (err instanceof ValidationError) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    },
  )
  // POST /api/novels/:id/settings/draft - 設定ドラフト生成
  .post(
    '/:id/settings/draft',
    zValidator('param', idParamSchema),
    zValidator('json', settingDraftSchema),
    async (c) => {
      const service = new SettingDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { instruction, currentDraft } = c.req.valid('json');
      const category = currentDraft?.category ?? '';
      const result = await service.generateDraft(instruction, category);
      return c.json(result);
    },
  )
  // GET /api/novels/:id/settings/markdown - 設定マークダウン取得
  .get('/:id/settings/markdown', zValidator('param', idParamSchema), async (c) => {
    const service = new SettingDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    const markdown = await service.getMarkdown(id);
    return c.json({ markdown });
  })
  // POST /api/novels/:id/settings/markdown - 設定マークダウン一括保存
  .post(
    '/:id/settings/markdown',
    zValidator('param', idParamSchema),
    zValidator('json', saveSettingsMarkdownSchema),
    async (c) => {
      const service = new SettingDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id } = c.req.valid('param');
      const { markdown } = c.req.valid('json');
      const result = await service.saveMarkdown(id, markdown);
      return c.json({
        created: result.createdCount,
        updated: result.updatedCount,
        deleted: result.deletedCount,
        duplicateCount: 0,
      });
    },
  )
  // POST /api/novels/:id/settings/edit-section - 設定セクションLLM編集
  .post(
    '/:id/settings/edit-section',
    zValidator('param', idParamSchema),
    zValidator('json', editSettingSectionSchema),
    async (c) => {
      const service = new SettingDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const parsedSummary = await service.editSettingSection({
        novelId: id,
        category: body.category,
        name: body.name,
        description: body.description,
        instruction: body.instruction,
      });
      return c.json({ markdown: parsedSummary ?? '' });
    },
  )
  // POST /api/novels/:id/settings/edit-document - 設定マークダウン全体LLM編集
  .post(
    '/:id/settings/edit-document',
    zValidator('param', idParamSchema),
    zValidator('json', editSettingDocumentSchema),
    async (c) => {
      const service = new SettingDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id } = c.req.valid('param');
      const { markdown, instruction } = c.req.valid('json');
      const parsedSummary = await service.editSettingDocument(id, markdown, instruction);
      return c.json({ markdown: parsedSummary ?? '' });
    },
  )
  // GET /api/novels/:id/timelines - 時系列一覧
  .get('/:id/timelines', zValidator('param', idParamSchema), async (c) => {
    const service = new TimelineDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    const rows = await service.listTimelines(id);
    return c.json(rows);
  })
  // POST /api/novels/:id/timelines - 時系列作成
  .post(
    '/:id/timelines',
    zValidator('param', idParamSchema),
    zValidator('json', createTimelineSchema),
    async (c) => {
      const service = new TimelineDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id: novelId } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const row = await service.createTimeline({
          novelId,
          sectionId: body.sectionId || null,
          event: body.event,
          order: body.order,
          timestamp: body.timestamp || null,
        });
        return c.json(row, 201);
      } catch (err) {
        if (err instanceof ValidationError) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    },
  )
  // GET /api/novels/:id/llm-instructions - 指示履歴一覧
  .get(
    '/:id/llm-instructions',
    zValidator('param', idParamSchema),
    zValidator('query', z.object({ entityType: z.string().optional() })),
    async (c) => {
      const service = new LlmInstructionDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id } = c.req.valid('param');
      const { entityType } = c.req.valid('query');
      const rows = await service.listInstructions(id, entityType);
      return c.json(rows);
    },
  )
  // POST /api/novels/:id/llm-instructions - 指示履歴作成
  .post(
    '/:id/llm-instructions',
    zValidator('param', idParamSchema),
    zValidator('json', createLlmInstructionSchema),
    async (c) => {
      const service = new LlmInstructionDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const { id: novelId } = c.req.valid('param');
      const body = c.req.valid('json');
      try {
        const row = await service.createInstruction({
          novelId,
          entityType: body.entityType,
          instruction: body.instruction,
        });
        return c.json(row, 201);
      } catch (err) {
        if (err instanceof ValidationError) {
          return c.json({ error: err.message }, 400);
        }
        throw err;
      }
    },
  )
  // POST /api/novels/:id/generate/plot - プロット生成
  .post('/:id/generate/plot', zValidator('param', idParamSchema), async (c) => {
    const service = new GenerateDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id: novelId } = c.req.valid('param');
    try {
      const result = await service.generatePlot(novelId);
      return c.json(result);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Novel not found' }, 404);
      }
      throw err;
    }
  });

export default novelsRouter;
