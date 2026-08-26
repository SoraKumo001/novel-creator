import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import type { timelines } from '@novel-creator/db';
import { TimelineService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';
import { NotFoundError, TimelineDomainService, ValidationError } from '../core/index.js';

function formatTimeline(row: typeof timelines.$inferSelect) {
  return {
    id: row.id,
    novelId: row.novelId,
    sectionId: row.sectionId ?? undefined,
    event: row.event,
    order: row.order,
    timestamp: row.timestamp ?? undefined,
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
  };
}

export function registerTimelineService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(TimelineService, {
    async listTimelines(req) {
      const service = new TimelineDomainService(getContext());
      const rows = await service.listTimelines(req.novelId);
      return {
        timelines: rows.map(formatTimeline),
      };
    },

    async createTimeline(req) {
      const service = new TimelineDomainService(getContext());
      try {
        const row = await service.createTimeline({
          novelId: req.novelId,
          sectionId: req.sectionId || null,
          event: req.event,
          order: req.order > 0 ? req.order : undefined,
          timestamp: req.timestamp || null,
        });
        return formatTimeline(row);
      } catch (err) {
        if (err instanceof ValidationError) {
          throw new ConnectError(err.message, Code.InvalidArgument);
        }
        throw err;
      }
    },

    async deleteTimeline(req) {
      const service = new TimelineDomainService(getContext());
      try {
        await service.deleteTimeline(req.id);
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
