import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import { HistoryService } from '@novel-creator/proto';
import type { AppContext } from '../context.js';
import { HistoryDomainService, NotFoundError } from '../core/index.js';

export function registerHistoryService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(HistoryService, {
    async listHistories(req) {
      const service = new HistoryDomainService(getContext());
      try {
        const list = await service.listHistories(req.novelId, {
          entityType: req.entityType || undefined,
          entityId: req.entityId || undefined,
          limit: req.limit || undefined,
        });

        return {
          histories: list.map((h) => ({
            id: h.id,
            novelId: h.novelId,
            entityType: h.entityType,
            entityId: h.entityId,
            title: h.title,
            content: h.content,
            description: h.description,
            wordCount: h.wordCount ?? undefined,
            createdAt: h.createdAt.toISOString(),
          })),
        };
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async getHistory(req) {
      const service = new HistoryDomainService(getContext());
      try {
        const h = await service.getHistory(req.id);
        return {
          id: h.id,
          novelId: h.novelId,
          entityType: h.entityType,
          entityId: h.entityId,
          title: h.title,
          content: h.content,
          description: h.description,
          wordCount: h.wordCount ?? undefined,
          createdAt: h.createdAt.toISOString(),
        };
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async restoreHistory(req) {
      const service = new HistoryDomainService(getContext());
      try {
        return await service.restoreHistory(req.id);
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },
  });
}
