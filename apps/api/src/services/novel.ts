import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import type { novels } from '@novel-creator/db';
import { NovelService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';
import { NotFoundError, NovelDomainService, ValidationError } from '../core/index.js';

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
      const service = new NovelDomainService(getContext());
      const rows = await service.listNovels();
      return {
        novels: rows.map(formatNovel),
      };
    },

    async getNovelDetail(req) {
      const service = new NovelDomainService(getContext());
      try {
        const detail = await service.getNovelDetail(req.id);
        return {
          novel: formatNovel(detail.novel),
          chapters: detail.chapters.map((ch) => ({
            id: ch.id,
            novelId: ch.novelId,
            title: ch.title,
            order: ch.order,
            summary: ch.summary ?? undefined,
            createdAt: ch.createdAt ? ch.createdAt.toISOString() : undefined,
            updatedAt: ch.updatedAt ? ch.updatedAt.toISOString() : undefined,
          })),
          characters: detail.characters.map((c) => ({
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
          settings: detail.settings.map((s) => ({
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
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async createNovel(req) {
      const service = new NovelDomainService(getContext());
      try {
        const row = await service.createNovel({
          title: req.title,
          description: req.description ?? null,
        });
        return formatNovel(row);
      } catch (err) {
        if (err instanceof ValidationError) {
          throw new ConnectError(err.message, Code.InvalidArgument);
        }
        throw err;
      }
    },

    async updateNovel(req) {
      const service = new NovelDomainService(getContext());
      try {
        const row = await service.updateNovel(req.id, {
          title: req.title || undefined,
          description: req.description !== undefined ? req.description : undefined,
        });
        return formatNovel(row);
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async deleteNovel(req) {
      const service = new NovelDomainService(getContext());
      try {
        await service.deleteNovel(req.id);
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
