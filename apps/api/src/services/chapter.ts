import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import type { chapters } from '@novel-creator/db';
import { ChapterService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';
import { ChapterDomainService, NotFoundError, ValidationError } from '../core/index.js';

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
      const service = new ChapterDomainService(getContext());
      const rows = await service.listChapters(req.novelId);
      return {
        chapters: rows.map(formatChapter),
      };
    },

    async getChapter(req) {
      const service = new ChapterDomainService(getContext());
      try {
        const { chapter, sections } = await service.getChapterWithSections(req.id);
        return {
          chapter: formatChapter(chapter),
          sections: sections.map((s) => ({
            id: s.id,
            chapterId: s.chapterId,
            title: s.title ?? undefined,
            order: s.order,
            summary: s.summary ?? undefined,
            createdAt: s.createdAt ? s.createdAt.toISOString() : undefined,
            updatedAt: s.updatedAt ? s.updatedAt.toISOString() : undefined,
          })),
        };
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async createChapter(req) {
      const service = new ChapterDomainService(getContext());
      try {
        const row = await service.createChapter({
          novelId: req.novelId,
          title: req.title,
          order: req.order > 0 ? req.order : undefined,
          summary: req.summary ?? null,
        });
        return formatChapter(row);
      } catch (err) {
        if (err instanceof ValidationError) {
          throw new ConnectError(err.message, Code.InvalidArgument);
        }
        throw err;
      }
    },

    async updateChapter(req) {
      const service = new ChapterDomainService(getContext());
      try {
        const row = await service.updateChapter(req.id, {
          title: req.title || undefined,
          order: req.order !== undefined ? req.order : undefined,
          summary: req.summary !== undefined ? req.summary : undefined,
        });
        return formatChapter(row);
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async deleteChapter(req) {
      const service = new ChapterDomainService(getContext());
      try {
        await service.deleteChapter(req.id);
        return { success: true };
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },
  });
}
