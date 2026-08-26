import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import type { contents } from '@novel-creator/db';
import { ContentService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';
import { ContentDomainService, NotFoundError } from '../core/index.js';

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
      const service = new ContentDomainService(getContext());
      try {
        const row = await service.getContent(req.sectionId);
        return formatContent(row);
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async updateContent(req) {
      const service = new ContentDomainService(getContext());
      const row = await service.updateContent(req.sectionId, req.body);
      return formatContent(row);
    },
  });
}
