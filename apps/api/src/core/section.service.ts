import { contents, sections } from "@novel-creator/db";
import { eq } from "drizzle-orm";
import { assertFound, type ServiceContext } from "./types.js";

/**
 * 指定章内の次の節 order 番号を算出する。
 */
async function getNextSectionOrder(
  ctx: ServiceContext,
  chapterId: string
): Promise<number> {
  const rows = await ctx.db
    .select({ order: sections.order })
    .from(sections)
    .where(eq(sections.chapterId, chapterId))
    .orderBy(sections.order);

  const last = rows.at(-1);
  return last && typeof last.order === "number" ? last.order + 1 : 1;
}

export class SectionDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async listSections(chapterId: string) {
    return this.ctx.db
      .select()
      .from(sections)
      .where(eq(sections.chapterId, chapterId))
      .orderBy(sections.order);
  }

  async getSectionWithContent(id: string) {
    const [section] = await this.ctx.db
      .select()
      .from(sections)
      .where(eq(sections.id, id));
    assertFound(section, "Section not found");
    const [content] = await this.ctx.db
      .select()
      .from(contents)
      .where(eq(contents.sectionId, id));

    return {
      content: content ?? null,
      section,
    };
  }

  async createSection(data: {
    chapterId: string;
    title?: string | null;
    order?: number;
    summary?: string | null;
  }) {
    const order =
      data.order !== undefined && data.order > 0
        ? data.order
        : await getNextSectionOrder(this.ctx, data.chapterId);

    const [row] = await this.ctx.db
      .insert(sections)
      .values({
        chapterId: data.chapterId,
        order,
        summary: data.summary ?? null,
        title: data.title || null,
      })
      .returning();
    return row;
  }

  async updateSection(
    id: string,
    data: { title?: string | null; order?: number; summary?: string | null }
  ) {
    const [row] = await this.ctx.db
      .update(sections)
      .set({
        ...(data.title === undefined ? {} : { title: data.title || null }),
        ...(data.order === undefined ? {} : { order: data.order }),
        ...(data.summary === undefined ? {} : { summary: data.summary }),
        updatedAt: new Date(),
      })
      .where(eq(sections.id, id))
      .returning();
    assertFound(row, "Section not found");
    return row;
  }

  async deleteSection(id: string) {
    const [row] = await this.ctx.db
      .delete(sections)
      .where(eq(sections.id, id))
      .returning();
    assertFound(row, "Section not found");
    return row;
  }
}
