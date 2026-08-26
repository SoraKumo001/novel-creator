import { eq } from 'drizzle-orm';
import { contents, sections } from '@novel-creator/db';
import { getNextSectionOrder } from '../routes/helpers.js';
import { NotFoundError, type ServiceContext } from './types.js';

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
    const [section] = await this.ctx.db.select().from(sections).where(eq(sections.id, id));
    if (!section) {
      throw new NotFoundError('Section not found');
    }
    const [content] = await this.ctx.db.select().from(contents).where(eq(contents.sectionId, id));

    return {
      section,
      content: content ?? null,
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
        : await getNextSectionOrder(this.ctx.db, data.chapterId);

    const [row] = await this.ctx.db
      .insert(sections)
      .values({
        chapterId: data.chapterId,
        title: data.title || null,
        order,
        summary: data.summary ?? null,
      })
      .returning();
    return row;
  }

  async updateSection(
    id: string,
    data: { title?: string | null; order?: number; summary?: string | null },
  ) {
    const [row] = await this.ctx.db
      .update(sections)
      .set({
        ...(data.title !== undefined ? { title: data.title || null } : {}),
        ...(data.order !== undefined ? { order: data.order } : {}),
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        updatedAt: new Date(),
      })
      .where(eq(sections.id, id))
      .returning();
    if (!row) {
      throw new NotFoundError('Section not found');
    }
    return row;
  }

  async deleteSection(id: string) {
    const [row] = await this.ctx.db.delete(sections).where(eq(sections.id, id)).returning();
    if (!row) {
      throw new NotFoundError('Section not found');
    }
    return row;
  }
}
