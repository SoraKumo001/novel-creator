import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import { eq } from 'drizzle-orm';
import { chapters, sections } from '@novel-creator/db';
import { ChapterService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';
import { getNextChapterOrder } from '../routes/helpers.js';

function formatChapter(row: typeof chapters.$inferSelect) {
  return {
    id: row.id,
    novelId: row.novelId,
    title: row.title,
    order: row.order,
    summary: row.summary ?? undefined,
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
  };
}

export function registerChapterService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(ChapterService, {
    async listChapters(req) {
      const db = getContext().db;
      const rows = await db
        .select()
        .from(chapters)
        .where(eq(chapters.novelId, req.novelId))
        .orderBy(chapters.order);
      return {
        chapters: rows.map(formatChapter),
      };
    },

    async getChapter(req) {
      const db = getContext().db;
      const [chapter] = await db.select().from(chapters).where(eq(chapters.id, req.id));
      if (!chapter) {
        throw new ConnectError('Chapter not found', Code.NotFound);
      }
      const sectionRows = await db
        .select()
        .from(sections)
        .where(eq(sections.chapterId, req.id))
        .orderBy(sections.order);

      return {
        chapter: formatChapter(chapter),
        sections: sectionRows.map((s) => ({
          id: s.id,
          chapterId: s.chapterId,
          title: s.title ?? undefined,
          order: s.order,
          summary: s.summary ?? undefined,
          createdAt: s.createdAt ? s.createdAt.toISOString() : undefined,
          updatedAt: s.updatedAt ? s.updatedAt.toISOString() : undefined,
        })),
      };
    },

    async createChapter(req) {
      const db = getContext().db;
      if (!req.title.trim()) {
        throw new ConnectError('Title is required', Code.InvalidArgument);
      }
      const order = req.order > 0 ? req.order : await getNextChapterOrder(db, req.novelId);
      const [row] = await db
        .insert(chapters)
        .values({
          novelId: req.novelId,
          title: req.title,
          order,
          summary: req.summary ?? null,
        })
        .returning();
      return formatChapter(row);
    },

    async updateChapter(req) {
      const db = getContext().db;
      const [row] = await db
        .update(chapters)
        .set({
          ...(req.title ? { title: req.title } : {}),
          ...(req.order !== undefined ? { order: req.order } : {}),
          ...(req.summary !== undefined ? { summary: req.summary } : {}),
          updatedAt: new Date(),
        })
        .where(eq(chapters.id, req.id))
        .returning();
      if (!row) {
        throw new ConnectError('Chapter not found', Code.NotFound);
      }
      return formatChapter(row);
    },

    async deleteChapter(req) {
      const db = getContext().db;
      const [row] = await db.delete(chapters).where(eq(chapters.id, req.id)).returning();
      if (!row) {
        throw new ConnectError('Chapter not found', Code.NotFound);
      }
      return { success: true };
    },
  });
}
