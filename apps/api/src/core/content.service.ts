import { eq } from 'drizzle-orm';
import { contents } from '@novel-creator/db';
import { NotFoundError, type ServiceContext } from './types.js';

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // 日本語は文字数、それ以外は空白区切りの単語数で概算する。
  const japanese = trimmed.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g);
  if (japanese && japanese.length > 0) {
    return japanese.length;
  }
  return trimmed.split(/\s+/).length;
}

export class ContentDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async getContent(sectionId: string) {
    const [row] = await this.ctx.db
      .select()
      .from(contents)
      .where(eq(contents.sectionId, sectionId));
    if (!row) {
      throw new NotFoundError('Content not found');
    }
    return row;
  }

  async updateContent(sectionId: string, body: string) {
    const wordCount = countWords(body);
    const [row] = await this.ctx.db
      .insert(contents)
      .values({ sectionId, body, wordCount })
      .onConflictDoUpdate({
        target: contents.sectionId,
        set: { body, wordCount, updatedAt: new Date() },
      })
      .returning();
    return row;
  }
}
