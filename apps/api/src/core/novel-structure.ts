import { inArray, sql } from 'drizzle-orm';
import {
  chapters,
  contents,
  sections,
  type Chapter,
  type Database,
  type Section,
} from '@novel-creator/db';

/** 1 節分のノード。body は contentMode に応じた本文（全文 / スニペット）。本文未作成の場合は null。 */
export interface SectionNode {
  section: Section;
  body: string | null;
}

/** 1 章分のノード。sections は節 order 昇順で整列済み。 */
export interface ChapterNode {
  chapter: Chapter;
  sections: SectionNode[];
}

/**
 * 本文の取得モード。
 * - 'full': contents.body の全文を取得する。
 * - 'snippet': DB 側で left(body, snippetLength) に切り詰めて取得し、転送量を削減する。
 * - 'none': 本文を取得しない（body は常に null、contents へのクエリを発行しない）。
 */
export type ContentFetchMode = 'full' | 'snippet' | 'none';

export interface FetchNovelStructureOptions {
  contentMode?: ContentFetchMode;
  /** contentMode='snippet' 時に取得する本文の最大文字数（DB 側で切り詰め）。既定値 300。 */
  snippetLength?: number;
}

/**
 * chapters / sections / contents をバルク取得（最大 3 クエリ）し、
 * 小説 ID ごとに「章 order 昇順 → 節 order 昇順」で組み立てた構造を返す。
 * 従来の「章ごと・節ごとの個別 SELECT（N+1）」を解消するための共通ヘルパ。
 *
 * - 並び順はメモリ側で明示ソートして保証する（同一 order の場合は DB の返却順を維持）。
 * - 存在しない小説 ID は空配列として返る。
 * - contentMode='snippet' の場合は本文を DB 側で切り詰めるため、
 *   長文小説でも必要なスニペット分のみ転送される。
 */
export async function fetchNovelStructureWithContents(
  db: Database,
  novelIds: readonly string[],
  options: FetchNovelStructureOptions = {},
): Promise<Map<string, ChapterNode[]>> {
  const contentMode = options.contentMode ?? 'full';
  const snippetLength = options.snippetLength ?? 300;

  const result = new Map<string, ChapterNode[]>();
  for (const novelId of novelIds) {
    result.set(novelId, []);
  }
  if (novelIds.length === 0) {
    return result;
  }

  // (a) chapters を一括取得
  const chapterRows = await db
    .select()
    .from(chapters)
    .where(inArray(chapters.novelId, [...novelIds]));

  const chapterNodeById = new Map<string, ChapterNode>();
  const chapterNodesByNovel = new Map<string, ChapterNode[]>();
  for (const chapter of chapterRows) {
    let nodes = chapterNodesByNovel.get(chapter.novelId);
    if (!nodes) {
      nodes = [];
      chapterNodesByNovel.set(chapter.novelId, nodes);
    }
    const node: ChapterNode = { chapter, sections: [] };
    nodes.push(node);
    chapterNodeById.set(chapter.id, node);
  }
  for (const [novelId, nodes] of chapterNodesByNovel) {
    // 章 order 昇順（安定ソートにより同一 order は DB の返却順を維持）
    nodes.sort((a, b) => a.chapter.order - b.chapter.order);
    result.get(novelId)?.push(...nodes);
  }

  if (chapterRows.length === 0) {
    return result;
  }

  // (b) sections を一括取得
  const sectionRows = await db
    .select()
    .from(sections)
    .where(
      inArray(
        sections.chapterId,
        chapterRows.map((chapter) => chapter.id),
      ),
    );

  const sectionNodesByChapter = new Map<string, SectionNode[]>();
  for (const section of sectionRows) {
    let nodes = sectionNodesByChapter.get(section.chapterId);
    if (!nodes) {
      nodes = [];
      sectionNodesByChapter.set(section.chapterId, nodes);
    }
    nodes.push({ section, body: null });
  }
  for (const nodes of sectionNodesByChapter.values()) {
    // 節 order 昇順（安定ソートにより同一 order は DB の返却順を維持）
    nodes.sort((a, b) => a.section.order - b.section.order);
  }
  for (const node of chapterNodeById.values()) {
    node.sections = sectionNodesByChapter.get(node.chapter.id) ?? [];
  }

  if (contentMode === 'none') {
    return result;
  }

  // (c) contents を一括取得
  const sectionIds = sectionRows.map((section) => section.id);
  if (sectionIds.length === 0) {
    return result;
  }

  const bodyBySectionId = new Map<string, string>();
  if (contentMode === 'snippet') {
    // 本文全文を転送せず、DB 側で先頭 snippetLength 文字に切り詰める。
    const rows = await db
      .select({
        sectionId: contents.sectionId,
        body: sql<string>`left(${contents.body}, ${snippetLength})`,
      })
      .from(contents)
      .where(inArray(contents.sectionId, sectionIds));
    for (const row of rows) {
      bodyBySectionId.set(row.sectionId, row.body);
    }
  } else {
    const rows = await db.select().from(contents).where(inArray(contents.sectionId, sectionIds));
    for (const row of rows) {
      bodyBySectionId.set(row.sectionId, row.body);
    }
  }

  for (const node of chapterNodeById.values()) {
    for (const sectionNode of node.sections) {
      sectionNode.body = bodyBySectionId.get(sectionNode.section.id) ?? null;
    }
  }

  return result;
}
