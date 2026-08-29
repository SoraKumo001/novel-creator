import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import type { AppContext } from '../context.js';
import { getServices } from '../core/services.js';
import type { BackupBody } from '../core/index.js';
import { backupBodySchema } from '../schemas/index.js';

const backupRouter = new Hono<AppContext>()
  // POST /api/backup/export?novelId=... - 小説データの JSON エクスポート
  .post('/export', zValidator('query', z.object({ novelId: z.string().uuid() })), async (c) => {
    const { novelId } = c.req.valid('query');
    const exportData = await getServices(c).backup.exportNovel(novelId);
    return c.json(exportData);
  })
  // POST /api/backup/import - JSON バックアップからのインポート・復元
  .post('/import', zValidator('json', backupBodySchema), async (c) => {
    // backupBodySchema は構造のみを検証するため、行レベルの厳密な検証は importNovel が行う。
    // 型は緩い record 形状のため、境界で BackupBody へキャストする。
    const body = c.req.valid('json') as unknown as BackupBody;
    const result = await getServices(c).backup.importNovel(body);
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
  });

export default backupRouter;
