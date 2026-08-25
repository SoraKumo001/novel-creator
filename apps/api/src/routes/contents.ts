import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import { contents } from '@novel-creator/db';

import type { AppContext } from '../context.js';
import { sectionIdParamSchema, updateContentSchema } from '../schemas/index.js';

const contentsRouter = new Hono<AppContext>();

// GET /api/sections/:sectionId/content - 本文取得
contentsRouter.get(
  '/sections/:sectionId/content',
  zValidator('param', sectionIdParamSchema),
  async (c) => {
    const db = c.var.db;
    const { sectionId } = c.req.valid('param');
    const [row] = await db.select().from(contents).where(eq(contents.sectionId, sectionId));
    if (!row) return c.json({ error: 'Content not found' }, 404);
    return c.json(row);
  },
);

// PUT /api/sections/:sectionId/content - 本文更新（wordCount自動計算）
contentsRouter.put(
  '/sections/:sectionId/content',
  zValidator('param', sectionIdParamSchema),
  zValidator('json', updateContentSchema),
  async (c) => {
    const db = c.var.db;
    const { sectionId } = c.req.valid('param');
    const body = c.req.valid('json');
    const wordCount = countWords(body.body);
    const [row] = await db
      .insert(contents)
      .values({ sectionId, body: body.body, wordCount })
      .onConflictDoUpdate({
        target: contents.sectionId,
        set: { body: body.body, wordCount, updatedAt: new Date() },
      })
      .returning();
    return c.json(row);
  },
);

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // 日本語は文字数、それ以外は空白区切りの単語数で概算する。
  const japanese = trimmed.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g);
  if (japanese && japanese.length > 0) {
    return japanese.length;
  }
  return trimmed.split(/\s+/).length;
}

export default contentsRouter;
