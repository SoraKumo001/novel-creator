import { eq } from 'drizzle-orm';
import { chapters, sections, type Database } from '@novel-creator/db';

/**
 * 指定小説内の次の章 order 番号を算出する。
 */
export async function getNextChapterOrder(db: Database, novelId: string): Promise<number> {
  const rows = await db
    .select({ order: chapters.order })
    .from(chapters)
    .where(eq(chapters.novelId, novelId))
    .orderBy(chapters.order);

  const last = rows[rows.length - 1];
  return last && typeof last.order === 'number' ? last.order + 1 : 1;
}

/**
 * 指定章内の次の節 order 番号を算出する。
 */
export async function getNextSectionOrder(db: Database, chapterId: string): Promise<number> {
  const rows = await db
    .select({ order: sections.order })
    .from(sections)
    .where(eq(sections.chapterId, chapterId))
    .orderBy(sections.order);

  const last = rows[rows.length - 1];
  return last && typeof last.order === 'number' ? last.order + 1 : 1;
}
