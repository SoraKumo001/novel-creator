import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import type { AppContext } from '../context.js';
import { getServices } from '../core/services.js';
import {
  analyzeSettingImpactBodySchema,
  analyzeStoryArcBodySchema,
  analysisResultParamsSchema,
  checkCharacterVoiceBodySchema,
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
  listAnalysisResultsQuerySchema,
  multiPersonaReviewBodySchema,
  saveCharactersMarkdownSchema,
  saveSettingsMarkdownSchema,
  settingDraftSchema,
  updateNovelSchema,
} from '../schemas/index.js';

const novelsRouter = new Hono<AppContext>()
  // GET /api/novels - 一覧取得
  .get('/', async (c) => {
    const rows = await getServices(c).novel.listNovels();
    return c.json(rows);
  })
  // POST /api/novels - 作成
  .post('/', zValidator('json', createNovelSchema), async (c) => {
    const body = c.req.valid('json');
    const row = await getServices(c).novel.createNovel({
      title: body.title,
      description: body.description ?? null,
    });
    return c.json(row, 201);
  })
  // GET /api/novels/:id - 個別取得（関連データ含む）
  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const detail = await getServices(c).novel.getNovelDetail(id);
    return c.json({
      ...detail.novel,
      chapters: detail.chapters,
      characters: detail.characters,
      settings: detail.settings,
    });
  })
  // PUT /api/novels/:id - 更新
  .put(
    '/:id',
    zValidator('param', idParamSchema),
    zValidator('json', updateNovelSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await getServices(c).novel.updateNovel(id, body);
      return c.json(row);
    },
  )
  // DELETE /api/novels/:id - 削除
  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    await getServices(c).novel.deleteNovel(id);
    return c.json({ success: true });
  })
  // GET /api/novels/:id/chapters - 章一覧
  .get('/:id/chapters', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const rows = await getServices(c).chapter.listChapters(id);
    return c.json(rows);
  })
  // POST /api/novels/:id/chapters - 章作成
  .post(
    '/:id/chapters',
    zValidator('param', idParamSchema),
    zValidator('json', createChapterSchema),
    async (c) => {
      const { id: novelId } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await getServices(c).chapter.createChapter({
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
  )
  // GET /api/novels/:id/settings - 設定一覧
  .get(
    '/:id/settings',
    zValidator('param', idParamSchema),
    zValidator('query', z.object({ category: z.string().optional() })),
    async (c) => {
      const { id } = c.req.valid('param');
      const { category } = c.req.valid('query');
      const rows = await getServices(c).setting.listSettings(id, category);
      return c.json(rows);
    },
  )
  // POST /api/novels/:id/settings - 設定作成
  .post(
    '/:id/settings',
    zValidator('param', idParamSchema),
    zValidator('json', createSettingSchema),
    async (c) => {
      const { id: novelId } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await getServices(c).setting.createSetting({
        novelId,
        category: body.category,
        name: body.name,
        description: body.description ?? null,
        metadata: (body.metadata as Record<string, unknown>) ?? {},
      });
      return c.json(row, 201);
    },
  )
  // POST /api/novels/:id/settings/draft - 設定ドラフト生成
  .post(
    '/:id/settings/draft',
    zValidator('param', idParamSchema),
    zValidator('json', settingDraftSchema),
    async (c) => {
      const { instruction, currentDraft } = c.req.valid('json');
      const category = currentDraft?.category ?? '';
      const result = await getServices(c).setting.generateDraft(instruction, category);
      return c.json(result);
    },
  )
  // GET /api/novels/:id/settings/markdown - 設定マークダウン取得
  .get('/:id/settings/markdown', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const markdown = await getServices(c).setting.getMarkdown(id);
    return c.json({ markdown });
  })
  // POST /api/novels/:id/settings/markdown - 設定マークダウン一括保存
  .post(
    '/:id/settings/markdown',
    zValidator('param', idParamSchema),
    zValidator('json', saveSettingsMarkdownSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { markdown } = c.req.valid('json');
      const result = await getServices(c).setting.saveMarkdown(id, markdown);
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
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const parsedSummary = await getServices(c).setting.editSettingSection({
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
      const { id } = c.req.valid('param');
      const { markdown, instruction } = c.req.valid('json');
      const parsedSummary = await getServices(c).setting.editSettingDocument(
        id,
        markdown,
        instruction,
      );
      return c.json({ markdown: parsedSummary ?? '' });
    },
  )
  // GET /api/novels/:id/timelines - 時系列一覧
  .get('/:id/timelines', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const rows = await getServices(c).timeline.listTimelines(id);
    return c.json(rows);
  })
  // POST /api/novels/:id/timelines - 時系列作成
  .post(
    '/:id/timelines',
    zValidator('param', idParamSchema),
    zValidator('json', createTimelineSchema),
    async (c) => {
      const { id: novelId } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await getServices(c).timeline.createTimeline({
        novelId,
        sectionId: body.sectionId || null,
        event: body.event,
        order: body.order,
        timestamp: body.timestamp || null,
      });
      return c.json(row, 201);
    },
  )
  // GET /api/novels/:id/llm-instructions - 指示履歴一覧
  .get(
    '/:id/llm-instructions',
    zValidator('param', idParamSchema),
    zValidator('query', z.object({ entityType: z.string().optional() })),
    async (c) => {
      const { id } = c.req.valid('param');
      const { entityType } = c.req.valid('query');
      const rows = await getServices(c).llmInstruction.listInstructions(id, entityType);
      return c.json(rows);
    },
  )
  // POST /api/novels/:id/llm-instructions - 指示履歴作成
  .post(
    '/:id/llm-instructions',
    zValidator('param', idParamSchema),
    zValidator('json', createLlmInstructionSchema),
    async (c) => {
      const { id: novelId } = c.req.valid('param');
      const body = c.req.valid('json');
      const row = await getServices(c).llmInstruction.createInstruction({
        novelId,
        entityType: body.entityType,
        instruction: body.instruction,
      });
      return c.json(row, 201);
    },
  )
  // POST /api/novels/:id/generate/plot - プロット生成
  .post(
    '/:id/generate/plot',
    zValidator('param', idParamSchema),
    zValidator(
      'json',
      z.object({ modelConfigId: z.string().uuid().optional().nullable() }).optional(),
    ),
    async (c) => {
      const { id: novelId } = c.req.valid('param');
      const jsonBody = c.req.valid('json');
      const result = await getServices(c).generate.generatePlot(novelId, jsonBody?.modelConfigId);
      return c.json(result);
    },
  )
  // POST /api/novels/:id/generate/check-voice - キャラクター口調・一貫性チェック (SSE ストリーミング)
  .post(
    '/:id/generate/check-voice',
    zValidator('param', idParamSchema),
    zValidator('json', checkCharacterVoiceBodySchema.optional()),
    async (c) => {
      const { id: novelId } = c.req.valid('param');
      const jsonBody = c.req.valid('json');

      return streamSSE(c, async (stream) => {
        try {
          for await (const ev of getServices(c).analysis.streamCheckVoice(
            novelId,
            jsonBody?.sectionId,
            jsonBody?.body,
            jsonBody?.modelConfigId,
          )) {
            await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({ type: 'error', message }),
          });
        }
      });
    },
  )
  // POST /api/novels/:id/generate/impact - 設定変更の影響範囲分析
  .post(
    '/:id/generate/impact',
    zValidator('param', idParamSchema),
    zValidator('json', analyzeSettingImpactBodySchema),
    async (c) => {
      const { id: novelId } = c.req.valid('param');
      const body = c.req.valid('json');
      const result = await getServices(c).generate.analyzeSettingImpact(novelId, {
        changeTarget: body.changeTarget,
        targetName: body.targetName,
        beforeValue: body.beforeValue,
        afterValue: body.afterValue,
        modelConfigId: body.modelConfigId,
      });
      return c.json(result);
    },
  )
  // POST /api/novels/:id/generate/story-arc - ストーリーアーク・テンション分析 (SSE ストリーミング)
  .post(
    '/:id/generate/story-arc',
    zValidator('param', idParamSchema),
    zValidator('json', analyzeStoryArcBodySchema.optional()),
    async (c) => {
      const { id: novelId } = c.req.valid('param');
      const jsonBody = c.req.valid('json');

      return streamSSE(c, async (stream) => {
        try {
          for await (const ev of getServices(c).analysis.streamStoryArc(
            novelId,
            jsonBody?.modelConfigId,
          )) {
            await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({ type: 'error', message }),
          });
        }
      });
    },
  )
  // POST /api/novels/:id/generate/persona-review - 複数ペルソナによる模擬読者レビュー (SSE ストリーミング)
  .post(
    '/:id/generate/persona-review',
    zValidator('param', idParamSchema),
    zValidator('json', multiPersonaReviewBodySchema.optional()),
    async (c) => {
      const { id: novelId } = c.req.valid('param');
      const jsonBody = c.req.valid('json');

      return streamSSE(c, async (stream) => {
        try {
          for await (const ev of getServices(c).analysis.streamPersonaReview(novelId, {
            sectionId: jsonBody?.sectionId,
            chapterId: jsonBody?.chapterId,
            customBody: jsonBody?.body,
            modelConfigId: jsonBody?.modelConfigId,
          })) {
            await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({ type: 'error', message }),
          });
        }
      });
    },
  )
  // GET /api/novels/:id/analysis-results - AI 分析結果履歴一覧
  .get(
    '/:id/analysis-results',
    zValidator('param', idParamSchema),
    zValidator('query', listAnalysisResultsQuerySchema),
    async (c) => {
      const { id: novelId } = c.req.valid('param');
      const query = c.req.valid('query');
      return c.json(await getServices(c).analysis.listResults(novelId, query.analysisType));
    },
  )
  // DELETE /api/novels/:id/analysis-results/:resultId - AI 分析結果履歴削除
  .delete(
    '/:id/analysis-results/:resultId',
    zValidator('param', analysisResultParamsSchema),
    async (c) => {
      const { id, resultId } = c.req.valid('param');
      await getServices(c).analysis.deleteResult(id, resultId);
      return c.json({ ok: true });
    },
  );

export default novelsRouter;
