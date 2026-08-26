import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import { desc, eq } from 'drizzle-orm';
import { chapters, characters, novels, settings } from '@novel-creator/db';
import { NovelService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';

function formatNovel(row: typeof novels.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
  };
}

export function registerNovelService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(NovelService, {
    async listNovels() {
      const db = getContext().db;
      const rows = await db.select().from(novels).orderBy(desc(novels.createdAt));
      return {
        novels: rows.map(formatNovel),
      };
    },

    async getNovelDetail(req) {
      const db = getContext().db;
      const [novel] = await db.select().from(novels).where(eq(novels.id, req.id));
      if (!novel) {
        throw new ConnectError('Novel not found', Code.NotFound);
      }

      const [chapterRows, characterRows, settingRows] = await Promise.all([
        db.select().from(chapters).where(eq(chapters.novelId, req.id)).orderBy(chapters.order),
        db.select().from(characters).where(eq(characters.novelId, req.id)),
        db.select().from(settings).where(eq(settings.novelId, req.id)),
      ]);

      return {
        novel: formatNovel(novel),
        chapters: chapterRows.map((ch) => ({
          id: ch.id,
          novelId: ch.novelId,
          title: ch.title,
          order: ch.order,
          summary: ch.summary ?? undefined,
          createdAt: ch.createdAt ? ch.createdAt.toISOString() : undefined,
          updatedAt: ch.updatedAt ? ch.updatedAt.toISOString() : undefined,
        })),
        characters: characterRows.map((c) => ({
          id: c.id,
          novelId: c.novelId,
          category: c.category,
          name: c.name,
          description: c.description ?? undefined,
          traits: (c.traits as string[]) ?? [],
          relationshipsJson: JSON.stringify(c.relationships ?? {}),
          createdAt: c.createdAt ? c.createdAt.toISOString() : undefined,
          updatedAt: c.updatedAt ? c.updatedAt.toISOString() : undefined,
        })),
        settings: settingRows.map((s) => ({
          id: s.id,
          novelId: s.novelId,
          category: s.category,
          name: s.name,
          description: s.description ?? undefined,
          metadataJson: JSON.stringify(s.metadata ?? {}),
          createdAt: s.createdAt ? s.createdAt.toISOString() : undefined,
          updatedAt: s.updatedAt ? s.updatedAt.toISOString() : undefined,
        })),
      };
    },

    async createNovel(req) {
      const db = getContext().db;
      if (!req.title.trim()) {
        throw new ConnectError('Title is required', Code.InvalidArgument);
      }
      const [row] = await db
        .insert(novels)
        .values({
          title: req.title,
          description: req.description ?? null,
        })
        .returning();
      return formatNovel(row);
    },

    async updateNovel(req) {
      const db = getContext().db;
      const [row] = await db
        .update(novels)
        .set({
          ...(req.title ? { title: req.title } : {}),
          ...(req.description !== undefined ? { description: req.description } : {}),
          updatedAt: new Date(),
        })
        .where(eq(novels.id, req.id))
        .returning();
      if (!row) {
        throw new ConnectError('Novel not found', Code.NotFound);
      }
      return formatNovel(row);
    },

    async deleteNovel(req) {
      const db = getContext().db;
      const [row] = await db.delete(novels).where(eq(novels.id, req.id)).returning();
      if (!row) {
        throw new ConnectError('Novel not found', Code.NotFound);
      }
      return { success: true };
    },
  });
}
