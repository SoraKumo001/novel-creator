import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { AppContext } from '../context.js';
import {
  ContentDomainService,
  GenerateDomainService,
  NotFoundError,
  SectionDomainService,
} from '../core/index.js';
import { idParamSchema, updateContentSchema, updateSectionSchema } from '../schemas/index.js';

const sectionsRouter = new Hono<AppContext>();

// GET /api/sections/:id - 節個別取得（本文含む）
sectionsRouter.get('/sections/:id', zValidator('param', idParamSchema), async (c) => {
  const service = new SectionDomainService({
    db: c.var.db,
    llm: c.var.llm,
    embedding: c.var.embedding,
    vectorStore: c.var.vectorStore,
    env: c.var.env,
  });
  const { id } = c.req.valid('param');
  try {
    const result = await service.getSectionWithContent(id);
    return c.json({
      ...result.section,
      content: result.content,
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ error: 'Section not found' }, 404);
    }
    throw err;
  }
});

// PUT /api/sections/:id - 節更新
sectionsRouter.put(
  '/sections/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateSectionSchema),
  async (c) => {
    const service = new SectionDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    try {
      const row = await service.updateSection(id, body);
      return c.json(row);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Section not found' }, 404);
      }
      throw err;
    }
  },
);

// DELETE /api/sections/:id - 節削除
sectionsRouter.delete('/sections/:id', zValidator('param', idParamSchema), async (c) => {
  const service = new SectionDomainService({
    db: c.var.db,
    llm: c.var.llm,
    embedding: c.var.embedding,
    vectorStore: c.var.vectorStore,
    env: c.var.env,
  });
  const { id } = c.req.valid('param');
  try {
    await service.deleteSection(id);
    return c.json({ success: true });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ error: 'Section not found' }, 404);
    }
    throw err;
  }
});

// GET /api/sections/:id/content - 本文取得
sectionsRouter.get('/sections/:id/content', zValidator('param', idParamSchema), async (c) => {
  const service = new ContentDomainService({
    db: c.var.db,
    llm: c.var.llm,
    embedding: c.var.embedding,
    vectorStore: c.var.vectorStore,
    env: c.var.env,
  });
  const { id } = c.req.valid('param');
  try {
    const row = await service.getContent(id);
    return c.json(row);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ error: 'Content not found' }, 404);
    }
    throw err;
  }
});

// PUT /api/sections/:id/content - 本文更新
sectionsRouter.put(
  '/sections/:id/content',
  zValidator('param', idParamSchema),
  zValidator('json', updateContentSchema),
  async (c) => {
    const service = new ContentDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const row = await service.updateContent(id, body.body);
    return c.json(row);
  },
);

// POST /api/sections/:id/generate/summary - 節概要生成
sectionsRouter.post(
  '/sections/:id/generate/summary',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = new GenerateDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    try {
      const result = await service.generateSectionSummary(id);
      return c.json(result);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Section not found' }, 404);
      }
      throw err;
    }
  },
);

// POST /api/sections/:id/generate/content - 本文ストリーミング生成
sectionsRouter.post(
  '/sections/:id/generate/content',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = new GenerateDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');

    try {
      const stream = service.generateSectionContent(id);
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Section not found' }, 404);
      }
      throw err;
    }
  },
);

// POST /api/sections/:id/generate/extract - 本文から設定・時系列を抽出
sectionsRouter.post(
  '/sections/:id/generate/extract',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = new GenerateDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    try {
      const result = await service.extractEntities(id);
      return c.json(result);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Section not found' }, 404);
      }
      throw err;
    }
  },
);

export default sectionsRouter;
