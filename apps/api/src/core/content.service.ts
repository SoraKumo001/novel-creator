import { eq } from 'drizzle-orm';
import { chapters, contents, editHistories, sections } from '@novel-creator/db';
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

  async updateContent(sectionId: string, body: string, description: string = '手動保存') {
    const wordCount = countWords(body);
    const [row] = await this.ctx.db
      .insert(contents)
      .values({ sectionId, body, wordCount })
      .onConflictDoUpdate({
        target: contents.sectionId,
        set: { body, wordCount, updatedAt: new Date() },
      })
      .returning();

    // 履歴を記録
    try {
      const [sec] = await this.ctx.db.select().from(sections).where(eq(sections.id, sectionId));
      if (sec) {
        const [ch] = await this.ctx.db
          .select()
          .from(chapters)
          .where(eq(chapters.id, sec.chapterId));
        if (ch) {
          await this.ctx.db.insert(editHistories).values({
            novelId: ch.novelId,
            entityType: 'content',
            entityId: sectionId,
            title: sec.title || `節 ${sec.order}`,
            content: body,
            description,
            wordCount,
          });
        }
      }
    } catch (e) {
      console.error('[history] failed to record content history', e);
    }

    return row;
  }
}
