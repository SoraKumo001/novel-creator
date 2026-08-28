import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import type { AppContext } from '../context.js';
import {
  BackupDomainService,
  NotFoundError,
  ValidationError,
  type BackupBody,
} from '../core/index.js';

const backupRouter = new Hono<AppContext>()
  // POST /api/backup/export?novelId=... - 小説データの JSON エクスポート
  .post('/export', zValidator('query', z.object({ novelId: z.string().uuid() })), async (c) => {
    const service = new BackupDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { novelId } = c.req.valid('query');

    try {
      const exportData = await service.exportNovel(novelId);
      return c.json(exportData);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Novel not found' }, 404);
      }
      throw err;
    }
  })
  // POST /api/backup/import - JSON バックアップからのインポート・復元
  .post('/import', zValidator('json', z.custom<BackupBody>()), async (c) => {
    const service = new BackupDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });

    const body = c.req.valid('json');

    try {
      const result = await service.importNovel(body);
      return c.json({
        success: true,
        novelId: result.novelId,
        counts: {
          chapters: body.rdb?.chapters?.length ?? 0,
          sections: body.rdb?.sections?.length ?? 0,
          contents: body.rdb?.contents?.length ?? 0,
          characters: body.rdb?.characters?.length ?? 0,
          settings: body.rdb?.settings?.length ?? 0,
          timelines: body.rdb?.timelines?.length ?? 0,
          llmInstructions: body.rdb?.llmInstructions?.length ?? 0,
          chatSessions: body.rdb?.chatSessions?.length ?? 0,
          chatMessages: body.rdb?.chatMessages?.length ?? 0,
        },
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }
  });

export default backupRouter;
