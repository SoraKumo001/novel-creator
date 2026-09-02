import { chapters, sections } from "@novel-creator/db";
import {
  diffPlot,
  parsePlotMarkdown,
  serializePlotToMarkdown,
} from "@novel-creator/shared";
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

  async getMarkdown(novelId: string) {
    const chaptersWithSections = await this.listChaptersWithSections(novelId);
    return serializePlotToMarkdown(chaptersWithSections);
  }

  async saveMarkdown(novelId: string, markdown: string) {
    const existingChapters = await this.listChaptersWithSections(novelId);
    const parsed = parsePlotMarkdown(markdown);
    const diff = diffPlot(existingChapters, parsed);

    let createdChaptersCount = 0;
    let updatedChaptersCount = 0;
    let deletedChaptersCount = 0;

    await this.ctx.db.transaction(async (tx) => {
      // 1. 新規章・節の作成
      for (const ch of diff.chaptersToCreate) {
        const [createdCh] = await tx
          .insert(chapters)
          .values({
            novelId,
            order: ch.order,
            summary: ch.summary || null,
            title: ch.title,
          })
          .returning();
        createdChaptersCount++;

        for (const sec of ch.sections) {
          await tx.insert(sections).values({
            chapterId: createdCh.id,
            order: sec.order,
            summary: sec.summary || null,
            title: sec.title || null,
          });
        }
      }

      // 2. 既存章の更新
      for (const ch of diff.chaptersToUpdate) {
        await tx
          .update(chapters)
          .set({
            order: ch.order,
            summary: ch.summary || null,
            title: ch.title,
            updatedAt: new Date(),
          })
          .where(eq(chapters.id, ch.id));
        updatedChaptersCount++;
      }

      // 3. 既存章への新規節追加
      for (const sec of diff.sectionsToCreate) {
        await tx.insert(sections).values({
          chapterId: sec.chapterId,
          order: sec.order,
          summary: sec.summary || null,
          title: sec.title || null,
        });
      }

      // 4. 既存節の更新
      for (const sec of diff.sectionsToUpdate) {
        await tx
          .update(sections)
          .set({
            order: sec.order,
            summary: sec.summary || null,
            title: sec.title || null,
            updatedAt: new Date(),
          })
          .where(eq(sections.id, sec.id));
      }

      // 5. 削除対象の節
      for (const secId of diff.sectionsToDelete) {
        await tx.delete(sections).where(eq(sections.id, secId));
      }

      // 6. 削除対象の章
      for (const chId of diff.chaptersToDelete) {
        await tx.delete(chapters).where(eq(chapters.id, chId));
        deletedChaptersCount++;
      }
    });

    return {
      createdCount: createdChaptersCount,
      deletedCount: deletedChaptersCount,
      updatedCount: updatedChaptersCount,
    };
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
