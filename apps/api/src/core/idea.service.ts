import { type IdeaStatus, ideas, novels } from "@novel-creator/db";
import { and, eq, ne } from "drizzle-orm";
import { assertFound, type ServiceContext, ValidationError } from "./types.js";

export const IDEA_STATUSES: readonly IdeaStatus[] = [
  "draft",
  "adopted",
  "rejected",
];

function assertIdeaStatus(status: string): asserts status is IdeaStatus {
  if (!(IDEA_STATUSES as readonly string[]).includes(status)) {
    throw new ValidationError(
      `Status must be one of: ${IDEA_STATUSES.join(", ")}`
    );
  }
}

export function ideaToText(i: {
  body?: string | null;
  status: string;
  title: string;
}): string {
  return `アイデア: ${i.title} (${i.status})\n${i.body ?? ""}`;
}

export class IdeaDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  /**
   * 小説のアイデア一覧。status 指定時はその status のみ返し、
   * 未指定時は rejected を除外する（蒸し返し防止）。
   */
  async listIdeas(novelId: string, options?: { status?: string }) {
    if (options?.status !== undefined) {
      assertIdeaStatus(options.status);
      return this.ctx.db
        .select()
        .from(ideas)
        .where(
          and(eq(ideas.novelId, novelId), eq(ideas.status, options.status))
        );
    }
    return this.ctx.db
      .select()
      .from(ideas)
      .where(and(eq(ideas.novelId, novelId), ne(ideas.status, "rejected")));
  }

  async getIdea(id: string) {
    const [idea] = await this.ctx.db
      .select()
      .from(ideas)
      .where(eq(ideas.id, id));
    assertFound(idea, "Idea not found");
    return idea;
  }

  async createIdea(
    novelId: string,
    data: {
      body?: string | null;
      source?: string | null;
      title: string;
    }
  ) {
    if (!data.title?.trim()) {
      throw new ValidationError("Title is required");
    }
    const [novel] = await this.ctx.db
      .select()
      .from(novels)
      .where(eq(novels.id, novelId));
    assertFound(novel, "Novel not found");

    const [created] = await this.ctx.db
      .insert(ideas)
      .values({
        body: data.body ?? null,
        novelId,
        source: data.source ?? null,
        status: "draft",
        title: data.title.trim(),
      })
      .returning();
    assertFound(created, "Idea not found");
    return created;
  }

  async updateIdea(id: string, data: { body?: string | null; title?: string }) {
    if (data.title !== undefined && !data.title.trim()) {
      throw new ValidationError("Title cannot be empty");
    }
    if (data.title === undefined && data.body === undefined) {
      throw new ValidationError("Nothing to update");
    }
    const [row] = await this.ctx.db
      .update(ideas)
      .set({
        ...(data.title === undefined ? {} : { title: data.title.trim() }),
        ...(data.body === undefined ? {} : { body: data.body }),
        updatedAt: new Date(),
      })
      .where(eq(ideas.id, id))
      .returning();
    assertFound(row, "Idea not found");
    return row;
  }

  async setIdeaStatus(id: string, status: string) {
    assertIdeaStatus(status);
    const [row] = await this.ctx.db
      .update(ideas)
      .set({ status, updatedAt: new Date() })
      .where(eq(ideas.id, id))
      .returning();
    assertFound(row, "Idea not found");
    return row;
  }
}
