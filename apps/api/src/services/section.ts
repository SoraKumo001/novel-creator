import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import { eq } from 'drizzle-orm';
import { contents, sections } from '@novel-creator/db';
import { SectionService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';
import { getNextSectionOrder } from '../routes/helpers.js';

function formatSection(row: typeof sections.$inferSelect) {
  return {
    id: row.id,
    chapterId: row.chapterId,
    title: row.title ?? undefined,
    order: row.order,
    summary: row.summary ?? undefined,
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
  };
}

export function registerSectionService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(SectionService, {
    async listSections(req) {
      const db = getContext().db;
      const rows = await db
        .select()
        .from(sections)
        .where(eq(sections.chapterId, req.chapterId))
        .orderBy(sections.order);
      return {
        sections: rows.map(formatSection),
      };
    },

    async getSection(req) {
      const db = getContext().db;
      const [section] = await db.select().from(sections).where(eq(sections.id, req.id));
      if (!section) {
        throw new ConnectError('Section not found', Code.NotFound);
      }
      const [content] = await db.select().from(contents).where(eq(contents.sectionId, req.id));

      return {
        section: formatSection(section),
        content: content
          ? {
              id: content.id,
              sectionId: content.sectionId,
              body: content.body,
              wordCount: content.wordCount ?? undefined,
              createdAt: content.createdAt ? content.createdAt.toISOString() : undefined,
              updatedAt: content.updatedAt ? content.updatedAt.toISOString() : undefined,
            }
          : undefined,
      };
    },

    async createSection(req) {
      const db = getContext().db;
      const order = req.order > 0 ? req.order : await getNextSectionOrder(db, req.chapterId);
      const [row] = await db
        .insert(sections)
        .values({
          chapterId: req.chapterId,
          title: req.title || null,
          order,
          summary: req.summary ?? null,
        })
        .returning();
      return formatSection(row);
    },

    async updateSection(req) {
      const db = getContext().db;
      const [row] = await db
        .update(sections)
        .set({
          ...(req.title !== undefined ? { title: req.title || null } : {}),
          ...(req.order !== undefined ? { order: req.order } : {}),
          ...(req.summary !== undefined ? { summary: req.summary } : {}),
          updatedAt: new Date(),
        })
        .where(eq(sections.id, req.id))
        .returning();
      if (!row) {
        throw new ConnectError('Section not found', Code.NotFound);
      }
      return formatSection(row);
    },

    async deleteSection(req) {
      const db = getContext().db;
      const [row] = await db.delete(sections).where(eq(sections.id, req.id)).returning();
      if (!row) {
        throw new ConnectError('Section not found', Code.NotFound);
      }
      return { success: true };
    },
  });
}
