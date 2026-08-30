import { desc, eq } from 'drizzle-orm';
import { chapters, characters, novels, settings } from '@novel-creator/db';
import { assertFound, ValidationError, type ServiceContext } from './types.js';

export class NovelDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async listNovels() {
    return this.ctx.db.select().from(novels).orderBy(desc(novels.createdAt));
  }

  async getNovelDetail(id: string) {
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, id));
    assertFound(novel, 'Novel not found');

    const [chapterRows, characterRows, settingRows] = await Promise.all([
      this.ctx.db.select().from(chapters).where(eq(chapters.novelId, id)).orderBy(chapters.order),
      this.ctx.db.select().from(characters).where(eq(characters.novelId, id)),
      this.ctx.db.select().from(settings).where(eq(settings.novelId, id)),
    ]);

    return {
      novel,
      chapters: chapterRows,
      characters: characterRows,
      settings: settingRows,
    };
  }

  async createNovel(data: {
    title: string;
    description?: string | null;
    styleGuide?: string | null;
  }) {
    if (!data.title?.trim()) {
      throw new ValidationError('Title is required');
    }
    const [row] = await this.ctx.db
      .insert(novels)
      .values({
        title: data.title,
        description: data.description ?? null,
        styleGuide: data.styleGuide ?? null,
      })
      .returning();
    return row;
  }

  async updateNovel(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      styleGuide?: string | null;
    },
  ) {
    const [row] = await this.ctx.db
      .update(novels)
      .set({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.styleGuide !== undefined ? { styleGuide: data.styleGuide } : {}),
        updatedAt: new Date(),
      })
      .where(eq(novels.id, id))
      .returning();
    assertFound(row, 'Novel not found');
    return row;
  }

  async deleteNovel(id: string) {
    const [row] = await this.ctx.db.delete(novels).where(eq(novels.id, id)).returning();
    assertFound(row, 'Novel not found');
    return row;
  }
}
