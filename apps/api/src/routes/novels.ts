import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppContext } from '../context.js';
import { getServices } from '../core/services.js';
import { createNovelSchema, idParamSchema, updateNovelSchema } from '../schemas/index.js';
import { novelAnalysisRouter } from './novels/analysis.js';
import { novelChaptersRouter } from './novels/chapters.js';
import { novelCharactersRouter } from './novels/characters.js';
import { novelForeshadowingsRouter } from './novels/foreshadowings.js';
import { novelInstructionsRouter } from './novels/instructions.js';
import { novelSettingsRouter } from './novels/settings.js';
import { novelStoryOutlineRouter } from './novels/storyOutline.js';
import { novelTimelinesRouter } from './novels/timelines.js';

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
      styleGuide: body.styleGuide ?? null,
      storyOutline: body.storyOutline ?? null,
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
  // サブルーターのマウント
  .route('/', novelChaptersRouter)
  .route('/', novelCharactersRouter)
  .route('/', novelSettingsRouter)
  .route('/', novelForeshadowingsRouter)
  .route('/', novelTimelinesRouter)
  .route('/', novelInstructionsRouter)
  .route('/', novelAnalysisRouter)
  .route('/', novelStoryOutlineRouter);

export default novelsRouter;
