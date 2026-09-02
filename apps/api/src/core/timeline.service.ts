import { timelines } from "@novel-creator/db";
import {
  diffTimelines,
  parseTimelinesMarkdown,
  serializeTimelinesToMarkdown,
} from "@novel-creator/shared";
import { eq } from "drizzle-orm";
import { assertFound, type ServiceContext, ValidationError } from "./types.js";

export class TimelineDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async listTimelines(novelId: string) {
    return this.ctx.db
      .select()
      .from(timelines)
      .where(eq(timelines.novelId, novelId))
      .orderBy(timelines.order);
  }

  async getMarkdown(novelId: string) {
    const rows = await this.listTimelines(novelId);
    return serializeTimelinesToMarkdown(rows);
  }

  async saveMarkdown(novelId: string, markdown: string) {
    const existing = await this.listTimelines(novelId);
    const parsed = parseTimelinesMarkdown(markdown);
    const diff = diffTimelines(existing, parsed);

    await this.ctx.db.transaction(async (tx) => {
      for (const item of diff.toCreate) {
        await tx.insert(timelines).values({
          event: item.event,
          novelId,
          order: item.order,
          sectionId: item.sectionId ?? null,
          timestamp: item.timestamp ?? null,
        });
      }

      for (const u of diff.toUpdate) {
        await tx
          .update(timelines)
          .set({
            event: u.event,
            order: u.order,
            sectionId: u.sectionId ?? null,
            timestamp: u.timestamp ?? null,
          })
          .where(eq(timelines.id, u.id));
      }

      for (const id of diff.toDelete) {
        await tx.delete(timelines).where(eq(timelines.id, id));
      }
    });

    return {
      createdCount: diff.toCreate.length,
      deletedCount: diff.toDelete.length,
      updatedCount: diff.toUpdate.length,
    };
  }

  async getNextTimelineOrder(novelId: string): Promise<number> {
    const rows = await this.ctx.db
      .select({ order: timelines.order })
      .from(timelines)
      .where(eq(timelines.novelId, novelId))
      .orderBy(timelines.order);
    return rows.length > 0 ? (rows.at(-1)?.order ?? 0) + 1 : 1;
  }

  async createTimeline(data: {
    novelId: string;
    event: string;
    order?: number;
    timestamp?: string | null;
    sectionId?: string | null;
  }) {
    if (!data.event?.trim()) {
      throw new ValidationError("Event is required");
    }
    const order =
      data.order !== undefined && data.order > 0
        ? data.order
        : await this.getNextTimelineOrder(data.novelId);

    const [row] = await this.ctx.db
      .insert(timelines)
      .values({
        event: data.event,
        novelId: data.novelId,
        order,
        sectionId: data.sectionId || null,
        timestamp: data.timestamp || null,
      })
      .returning();
    return row;
  }

  async updateTimeline(
    id: string,
    data: {
      event?: string;
      order?: number;
      timestamp?: string | null;
      sectionId?: string | null;
    }
  ) {
    const patch: Record<string, unknown> = {};
    if (data.event !== undefined) {
      if (!data.event.trim()) {
        throw new ValidationError("Event cannot be empty");
      }
      patch.event = data.event;
    }
    if (data.order !== undefined) {
      patch.order = data.order;
    }
    if (data.timestamp !== undefined) {
      patch.timestamp = data.timestamp;
    }
    if (data.sectionId !== undefined) {
      patch.sectionId = data.sectionId;
    }

    const [row] = await this.ctx.db
      .update(timelines)
      .set(patch)
      .where(eq(timelines.id, id))
      .returning();
    assertFound(row, "Timeline not found");
    return row;
  }

  async deleteTimeline(id: string) {
    const [row] = await this.ctx.db
      .delete(timelines)
      .where(eq(timelines.id, id))
      .returning();
    assertFound(row, "Timeline not found");
    return row;
  }
}
