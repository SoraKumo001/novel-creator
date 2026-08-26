import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import { eq } from 'drizzle-orm';
import { contents } from '@novel-creator/db';
import { ContentService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';

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

function formatContent(row: typeof contents.$inferSelect) {
  return {
    id: row.id,
    sectionId: row.sectionId,
    body: row.body,
    wordCount: row.wordCount ?? undefined,
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
  };
}

export function registerContentService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(ContentService, {
    async getContent(req) {
      const db = getContext().db;
      const [row] = await db.select().from(contents).where(eq(contents.sectionId, req.sectionId));
      if (!row) {
        throw new ConnectError('Content not found', Code.NotFound);
      }
      return formatContent(row);
    },

    async updateContent(req) {
      const db = getContext().db;
      const wordCount = countWords(req.body);
      const [row] = await db
        .insert(contents)
        .values({ sectionId: req.sectionId, body: req.body, wordCount })
        .onConflictDoUpdate({
          target: contents.sectionId,
          set: { body: req.body, wordCount, updatedAt: new Date() },
        })
        .returning();
      return formatContent(row);
    },
  });
}
