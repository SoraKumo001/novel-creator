import { chapters, sections } from "@novel-creator/db";
import { asc, eq } from "drizzle-orm";
import {
  NotFoundError,
  type ServiceContext,
  ValidationError,
} from "./types.js";

export class ChapterDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async listChapters(novelId: string) {
    return this.ctx.db
      .select()
      .from(chapters)
      .where(eq(chapters.novelId, novelId))
      .orderBy(asc(chapters.order));
  }

  async listChaptersWithSections(novelId: string) {
    const chapterRows = await this.listChapters(novelId);
    const sectionRows = await this.ctx.db
      .select()
      .from(sections)
      .orderBy(asc(sections.order));

    return chapterRows.map((ch) => ({
      ...ch,
      sections: sectionRows.filter((s) => s.chapterId === ch.id),
    }));
  }

  async getChapterWithSections(id: string) {
    const rows = await this.ctx.db
      .select()
      .from(chapters)
      .where(eq(chapters.id, id));
    if (rows.length === 0) {
      throw new NotFoundError("Chapter", id);
    }
    const chapter = rows[0];
    const secRows = await this.ctx.db
      .select()
      .from(sections)
      .where(eq(sections.chapterId, id))
      .orderBy(asc(sections.order));

    return {
      chapter,
      sections: secRows,
    };
  }

  async createChapter(data: {
    novelId: string;
    title: string;
    order?: number;
    summary?: string | null;
  }) {
    if (!data.title?.trim()) {
      throw new ValidationError("Chapter title cannot be empty");
    }

    let order = data.order;
    if (order === undefined) {
      const existing = await this.listChapters(data.novelId);
      order = existing.length + 1;
    }

    const inserted = await this.ctx.db
      .insert(chapters)
      .values({
        novelId: data.novelId,
        order,
        summary: data.summary ?? null,
        title: data.title.trim(),
      })
      .returning();

    return inserted[0];
  }

  async updateChapter(
    id: string,
    data: { title?: string; order?: number; summary?: string | null }
  ) {
    if (data.title !== undefined && !data.title.trim()) {
      throw new ValidationError("Chapter title cannot be empty");
    }

    const updated = await this.ctx.db
      .update(chapters)
      .set({
        ...(data.title === undefined ? {} : { title: data.title.trim() }),
        ...(data.order === undefined ? {} : { order: data.order }),
        ...(data.summary === undefined ? {} : { summary: data.summary }),
      })
      .where(eq(chapters.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundError("Chapter", id);
    }
    return updated[0];
  }

  async deleteChapter(id: string) {
    const deleted = await this.ctx.db
      .delete(chapters)
      .where(eq(chapters.id, id))
      .returning();

    if (deleted.length === 0) {
      throw new NotFoundError("Chapter", id);
    }
    return deleted[0];
  }
}
