import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import type { sections } from '@novel-creator/db';
import { SectionService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';
import { NotFoundError, SectionDomainService } from '../core/index.js';

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
      const service = new SectionDomainService(getContext());
      const rows = await service.listSections(req.chapterId);
      return {
        sections: rows.map(formatSection),
      };
    },

    async getSection(req) {
      const service = new SectionDomainService(getContext());
      try {
        const { section, content } = await service.getSectionWithContent(req.id);
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
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async createSection(req) {
      const service = new SectionDomainService(getContext());
      const row = await service.createSection({
        chapterId: req.chapterId,
        title: req.title || null,
        order: req.order > 0 ? req.order : undefined,
        summary: req.summary ?? null,
      });
      return formatSection(row);
    },

    async updateSection(req) {
      const service = new SectionDomainService(getContext());
      try {
        const row = await service.updateSection(req.id, {
          title: req.title !== undefined ? req.title || null : undefined,
          order: req.order !== undefined ? req.order : undefined,
          summary: req.summary !== undefined ? req.summary : undefined,
        });
        return formatSection(row);
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async deleteSection(req) {
      const service = new SectionDomainService(getContext());
      try {
        await service.deleteSection(req.id);
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
