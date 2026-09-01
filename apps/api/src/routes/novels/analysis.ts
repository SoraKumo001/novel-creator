import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppContext } from '../../context.js';
import { getServices } from '../../core/services.js';
import { streamEvents } from '../../sse.js';
import {
  analysisResultParamsSchema,
  analyzeSettingImpactBodySchema,
  analyzeStoryArcBodySchema,
  checkCharacterVoiceBodySchema,
  generateStyleGuideDraftBodySchema,
  idParamSchema,
  listAnalysisResultsQuerySchema,
  modelConfigBodySchema,
  multiPersonaReviewBodySchema,
} from '../../schemas/index.js';

export const novelAnalysisRouter = new Hono<AppContext>()
  // POST /api/novels/:id/generate/plot - プロット生成
  .post(
    '/:id/generate/plot',
    zValidator('param', idParamSchema),
    zValidator('json', modelConfigBodySchema.optional()),
    async (c) => {
      const { id: novelId } = c.req.valid('param');
      const jsonBody = c.req.valid('json');
      const result = await getServices(c).generate.generatePlot(novelId, jsonBody?.modelConfigId);
      return c.json(result);
    },
  )
  // POST /api/novels/:id/generate/style-guide - 執筆スタイルガイド下書き生成
  .post(
    '/:id/generate/style-guide',
    zValidator('param', idParamSchema),
    zValidator('json', generateStyleGuideDraftBodySchema.optional()),
    async (c) => {
      const { id: novelId } = c.req.valid('param');
      const jsonBody = c.req.valid('json');
      const draft = await getServices(c).generate.generateStyleGuideDraft(
        novelId,
        jsonBody?.modelConfigId,
      );
      return c.json({ draft });
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

      return streamEvents(c, async (emit) => {
        for await (const ev of getServices(c).analysis.streamCheckVoice(
          novelId,
          jsonBody?.sectionId,
          jsonBody?.body,
          jsonBody?.modelConfigId,
        )) {
          await emit(ev.type, ev);
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

      return streamEvents(c, async (emit) => {
        for await (const ev of getServices(c).analysis.streamStoryArc(
          novelId,
          jsonBody?.modelConfigId,
        )) {
          await emit(ev.type, ev);
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

      return streamEvents(c, async (emit) => {
        for await (const ev of getServices(c).analysis.streamPersonaReview(novelId, {
          sectionId: jsonBody?.sectionId,
          chapterId: jsonBody?.chapterId,
          customBody: jsonBody?.body,
          modelConfigId: jsonBody?.modelConfigId,
        })) {
          await emit(ev.type, ev);
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
