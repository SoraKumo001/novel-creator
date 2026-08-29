import { eq } from 'drizzle-orm';
import { timelines } from '@novel-creator/db';
import { assertFound, ValidationError, type ServiceContext } from './types.js';

export class TimelineDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async listTimelines(novelId: string) {
    return this.ctx.db
      .select()
      .from(timelines)
      .where(eq(timelines.novelId, novelId))
      .orderBy(timelines.order);
  }

  async getNextTimelineOrder(novelId: string): Promise<number> {
    const rows = await this.ctx.db
      .select({ order: timelines.order })
      .from(timelines)
      .where(eq(timelines.novelId, novelId))
      .orderBy(timelines.order);
    return rows.length > 0 ? (rows[rows.length - 1].order ?? 0) + 1 : 1;
  }

  async createTimeline(data: {
    novelId: string;
    event: string;
    order?: number;
    timestamp?: string | null;
    sectionId?: string | null;
  }) {
    if (!data.event?.trim()) {
      throw new ValidationError('Event is required');
    }
    const order =
      data.order !== undefined && data.order > 0
        ? data.order
        : await this.getNextTimelineOrder(data.novelId);

    const [row] = await this.ctx.db
      .insert(timelines)
      .values({
        novelId: data.novelId,
        sectionId: data.sectionId || null,
        event: data.event,
        order,
        timestamp: data.timestamp || null,
      })
      .returning();
    return row;
  }

  async deleteTimeline(id: string) {
    const [row] = await this.ctx.db.delete(timelines).where(eq(timelines.id, id)).returning();
    assertFound(row, 'Timeline not found');
    return row;
  }
}
