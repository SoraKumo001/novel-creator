import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { AppContext } from '../context.js';
import { NotFoundError, NovelDomainService } from '../core/index.js';
import { createNovelSchema, idParamSchema, updateNovelSchema } from '../schemas/index.js';

const novelsRouter = new Hono<AppContext>();

// GET /api/novels - 一覧取得
novelsRouter.get('/', async (c) => {
  const service = new NovelDomainService({
    db: c.var.db,
    llm: c.var.llm,
    embedding: c.var.embedding,
    vectorStore: c.var.vectorStore,
    env: c.var.env,
  });
  const rows = await service.listNovels();
  return c.json(rows);
});

// POST /api/novels - 作成
novelsRouter.post('/', zValidator('json', createNovelSchema), async (c) => {
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
});

// GET /api/novels/:id - 個別取得（関連データ含む）
novelsRouter.get('/:id', zValidator('param', idParamSchema), async (c) => {
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
});

// PUT /api/novels/:id - 更新
novelsRouter.put(
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
);

// DELETE /api/novels/:id - 削除
novelsRouter.delete('/:id', zValidator('param', idParamSchema), async (c) => {
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
});

export default novelsRouter;
