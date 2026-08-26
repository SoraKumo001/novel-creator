import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import { eq } from 'drizzle-orm';
import { timelines, type Database } from '@novel-creator/db';
import { TimelineService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';

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

async function nextTimelineOrder(db: Database, novelId: string): Promise<number> {
  const rows = await db
    .select({ order: timelines.order })
    .from(timelines)
    .where(eq(timelines.novelId, novelId))
    .orderBy(timelines.order);
  return rows.length > 0 ? (rows[rows.length - 1].order ?? 0) + 1 : 1;
}

export function registerTimelineService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(TimelineService, {
    async listTimelines(req) {
      const db = getContext().db;
      const rows = await db
        .select()
        .from(timelines)
        .where(eq(timelines.novelId, req.novelId))
        .orderBy(timelines.order);
      return {
        timelines: rows.map(formatTimeline),
      };
    },

    async createTimeline(req) {
      const db = getContext().db;
      if (!req.event.trim()) {
        throw new ConnectError('Event is required', Code.InvalidArgument);
      }
      const order = req.order > 0 ? req.order : await nextTimelineOrder(db, req.novelId);
      const [row] = await db
        .insert(timelines)
        .values({
          novelId: req.novelId,
          sectionId: req.sectionId || null,
          event: req.event,
          order,
          timestamp: req.timestamp || null,
        })
        .returning();
      return formatTimeline(row);
    },

    async deleteTimeline(req) {
      const db = getContext().db;
      const [row] = await db.delete(timelines).where(eq(timelines.id, req.id)).returning();
      if (!row) {
        throw new ConnectError('Timeline not found', Code.NotFound);
      }
      return { success: true };
    },
  });
}
