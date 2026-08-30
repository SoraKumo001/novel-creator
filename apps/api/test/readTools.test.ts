import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chapters as chaptersTable,
  characters as charactersTable,
  contents as contentsTable,
  foreshadowings as foreshadowingsTable,
  sections as sectionsTable,
  settings as settingsTable,
  timelines as timelinesTable,
} from '@novel-creator/db';

import { createReadTools } from '../src/core/tools/readTools.js';
import {
  MAX_LIST_ITEMS,
  MAX_SEARCH_ITEMS,
  MAX_STRUCTURE_ITEMS,
  MAX_TEXT_LENGTH,
  TRUNCATION_SUFFIX,
  isSectionInScope,
  truncateList,
  truncateText,
} from '../src/core/tools/readTools.js';
import { searchContext } from '../src/rag.js';
import type { ServiceContext } from '../src/core/types.js';

// searchNovelKnowledge が参照する RAG 検索をモック（chat.test.ts のモックパターンを踏襲）
vi.mock('../src/rag.js', () => ({
  searchContext: vi.fn(),
}));

// ===== 純関数（truncation ヘルパー）の unit test =====

describe('truncateText', () => {
  it('max 以内のテキストはそのまま返す', () => {
    expect(truncateText('短いテキスト', 600)).toBe('短いテキスト');
  });

  it('max を超えるテキストは切り詰められ、接尾辞が付与される', () => {
    const long = 'あ'.repeat(MAX_TEXT_LENGTH + 100);
    const result = truncateText(long, MAX_TEXT_LENGTH);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(MAX_TEXT_LENGTH + TRUNCATION_SUFFIX.length);
    expect(result!.startsWith('あ'.repeat(MAX_TEXT_LENGTH))).toBe(true);
    expect(result!.endsWith(TRUNCATION_SUFFIX)).toBe(true);
  });

  it('ちょうど max 文字の場合は切り詰めない', () => {
    const exact = 'い'.repeat(MAX_TEXT_LENGTH);
    expect(truncateText(exact, MAX_TEXT_LENGTH)).toBe(exact);
  });

  it('null / undefined は null を返す', () => {
    expect(truncateText(null)).toBeNull();
    expect(truncateText(undefined)).toBeNull();
  });

  it('空文字列はそのまま返す', () => {
    expect(truncateText('')).toBe('');
  });
});

describe('truncateList', () => {
  it('max 以内の配列は切り詰められない（notice は null）', () => {
    const result = truncateList([1, 2, 3], 30);
    expect(result.items).toEqual([1, 2, 3]);
    expect(result.total).toBe(3);
    expect(result.shown).toBe(3);
    expect(result.omitted).toBe(0);
    expect(result.notice).toBeNull();
  });

  it('max を超える配列は切り詰められ、省略明示が生成される', () => {
    const result = truncateList(
      Array.from({ length: 57 }, (_, i) => i),
      30,
    );
    expect(result.items).toHaveLength(30);
    expect(result.total).toBe(57);
    expect(result.shown).toBe(30);
    expect(result.omitted).toBe(27);
    expect(result.notice).toBe('[truncated: showing 30 of 57] 残り 27 件は省略されました');
  });

  it('truncationNotice は表示件数と総件数を含む文言を返す', () => {
    // truncateList 経由で検証済みだが、文言形式の統一規約として直接も確認する
    expect(
      truncateList(
        Array.from({ length: 31 }, (_, i) => i),
        30,
      ).notice,
    ).toBe('[truncated: showing 30 of 31] 残り 1 件は省略されました');
  });
});

describe('isSectionInScope', () => {
  it('章の novelId がバインドされた novelId と一致する場合は true', () => {
    expect(isSectionInScope('novel-1', { novelId: 'novel-1' })).toBe(true);
  });

  it('章の novelId が異なる場合は false', () => {
    expect(isSectionInScope('novel-1', { novelId: 'novel-2' })).toBe(false);
  });

  it('章が取得できない場合は false', () => {
    expect(isSectionInScope('novel-1', null)).toBe(false);
    expect(isSectionInScope('novel-1', undefined)).toBe(false);
  });

  it('バインドされた novelId がない場合は false', () => {
    expect(isSectionInScope(null, { novelId: 'novel-1' })).toBe(false);
    expect(isSectionInScope(undefined, { novelId: 'novel-1' })).toBe(false);
    expect(isSectionInScope('', { novelId: 'novel-1' })).toBe(false);
  });
});

// ===== ツール群（createReadTools）の unit test =====

type Row = Record<string, unknown>;
type TableName =
  'characters' | 'settings' | 'chapters' | 'sections' | 'contents' | 'foreshadowings' | 'timelines';

/**
 * chat.test.ts の createMockDb パターンを踏襲し、テーブル参照で select 結果を振り分けるモック DB。
 * ツール側のクエリは `.where(...)` 直待ちと `.where(...).orderBy(...)` の 2 形態のみのため、
 * where の戻り値を thenable + orderBy 持ちにして両方に対応する。
 */
function createMockDb(routes: Partial<Record<TableName, Row[]>>) {
  const tableMap: [unknown, Row[]][] = [
    [charactersTable, routes.characters ?? []],
    [settingsTable, routes.settings ?? []],
    [chaptersTable, routes.chapters ?? []],
    [sectionsTable, routes.sections ?? []],
    [contentsTable, routes.contents ?? []],
    [foreshadowingsTable, routes.foreshadowings ?? []],
    [timelinesTable, routes.timelines ?? []],
  ];

  const db = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: unknown) => {
        const rows = tableMap.find(([t]) => t === table)?.[1] ?? [];
        return {
          where: vi.fn().mockImplementation(() => ({
            orderBy: vi.fn().mockResolvedValue([...rows]),
            then: (resolve: (value: Row[]) => unknown, reject: (reason?: unknown) => unknown) =>
              Promise.resolve([...rows]).then(resolve, reject),
          })),
        };
      }),
    })),
  };

  return db;
}

function createCtx(db: unknown): ServiceContext {
  return {
    db: db as never,
    llm: {} as never,
    embedding: {} as never,
    vectorStore: {} as never,
    env: {} as never,
  };
}

function makeCharacters(novelId: string, count: number, description?: string): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `char-${i + 1}`,
    novelId,
    name: `人物${i + 1}`,
    category: '主要人物',
    description: description ?? `説明${i + 1}`,
    traits: [],
  }));
}

describe('readTools', () => {
  const NOVEL_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
  const OTHER_NOVEL_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createReadTools は 8 つの読み取りツールを返す', () => {
    const tools = createReadTools(createCtx(createMockDb({})), NOVEL_ID);
    expect(tools.getNovelInfo).toBeDefined();
    expect(tools.getCharacters).toBeDefined();
    expect(tools.getSettings).toBeDefined();
    expect(tools.getPlotAndChapters).toBeDefined();
    expect(tools.getSectionContent).toBeDefined();
    expect(tools.getForeshadowings).toBeDefined();
    expect(tools.getTimelines).toBeDefined();
    expect(tools.searchNovelKnowledge).toBeDefined();
  });

  it('novelId が未指定の場合にエラーを返す', async () => {
    const tools = createReadTools(createCtx(createMockDb({})), null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (tools.getNovelInfo as any).execute({ novelId: undefined });
    expect(res).toEqual({ error: '対象の小説が指定されていません。' });
  });

  describe('truncation', () => {
    it('getCharacters - 31 件中 30 件を返し、省略明示を含む', async () => {
      const tools = createReadTools(
        createCtx(createMockDb({ characters: makeCharacters(NOVEL_ID, 31) })),
        NOVEL_ID,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.getCharacters as any).execute({});

      expect(res.count).toBe(31);
      expect(res.truncated).toBe('[truncated: showing 30 of 31] 残り 1 件は省略されました');
      expect(res.characters).toHaveLength(MAX_LIST_ITEMS);
      expect(res.characters[0].name).toBe('人物1');
      expect(res.characters.find((c: Row) => c.name === '人物31')).toBeUndefined();
    });

    it('getCharacters - 30 件以下の場合は省略明示を含まない', async () => {
      const tools = createReadTools(
        createCtx(createMockDb({ characters: makeCharacters(NOVEL_ID, 30) })),
        NOVEL_ID,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.getCharacters as any).execute({});

      expect(res.count).toBe(30);
      expect(res.truncated).toBeUndefined();
      expect(res.characters).toHaveLength(30);
    });

    it('getCharacters - 長文 description が 600 文字で切り詰められ、接尾辞が付与される', async () => {
      const longDescription = '長'.repeat(MAX_TEXT_LENGTH + 50);
      const tools = createReadTools(
        createCtx(
          createMockDb({
            characters: [
              {
                id: 'char-1',
                novelId: NOVEL_ID,
                name: '長文人物',
                category: '主要人物',
                description: longDescription,
                traits: [],
              },
            ],
          }),
        ),
        NOVEL_ID,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.getCharacters as any).execute({});

      expect(res.characters).toHaveLength(1);
      const desc: string = res.characters[0].description;
      expect(desc.endsWith(TRUNCATION_SUFFIX)).toBe(true);
      expect(desc.length).toBe(MAX_TEXT_LENGTH + TRUNCATION_SUFFIX.length);
      expect(desc.startsWith('長'.repeat(MAX_TEXT_LENGTH))).toBe(true);
    });

    it('getCharacters - null description は null のまま', async () => {
      const tools = createReadTools(
        createCtx(
          createMockDb({
            characters: [
              {
                id: 'char-1',
                novelId: NOVEL_ID,
                name: '人物1',
                category: '主要人物',
                description: null,
              },
            ],
          }),
        ),
        NOVEL_ID,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.getCharacters as any).execute({});
      expect(res.characters[0].description).toBeNull();
    });

    it('getSettings - 31 件中 30 件を返し、省略明示を含む', async () => {
      const settings = Array.from({ length: 31 }, (_, i) => ({
        id: `setting-${i + 1}`,
        novelId: NOVEL_ID,
        name: `設定${i + 1}`,
        category: '世界観',
        description: `説明${i + 1}`,
      }));
      const tools = createReadTools(createCtx(createMockDb({ settings })), NOVEL_ID);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.getSettings as any).execute({});

      expect(res.count).toBe(31);
      expect(res.truncated).toBe('[truncated: showing 30 of 31] 残り 1 件は省略されました');
      expect(res.settings).toHaveLength(MAX_LIST_ITEMS);
    });

    it('getPlotAndChapters - 51 章で 50 章に切り詰め、省略明示を含む', async () => {
      const chapters = Array.from({ length: MAX_STRUCTURE_ITEMS + 1 }, (_, i) => ({
        id: `chapter-${i + 1}`,
        novelId: NOVEL_ID,
        title: `第${i + 1}章`,
        order: i + 1,
        summary: null,
      }));
      const tools = createReadTools(createCtx(createMockDb({ chapters })), NOVEL_ID);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.getPlotAndChapters as any).execute({});

      expect(res.chapterCount).toBe(MAX_STRUCTURE_ITEMS + 1);
      expect(res.truncated).toBe('[truncated: showing 50 of 51] 残り 1 件は省略されました');
      expect(res.chapters).toHaveLength(MAX_STRUCTURE_ITEMS);
    });

    it('getForeshadowings - 51 件で 50 件に切り詰め、省略明示を含む', async () => {
      const foreshadowings = Array.from({ length: MAX_STRUCTURE_ITEMS + 1 }, (_, i) => ({
        id: `foreshadowing-${i + 1}`,
        novelId: NOVEL_ID,
        title: `伏線${i + 1}`,
        status: 'unresolved',
        description: `説明${i + 1}`,
        placedSectionId: null,
        resolvedSectionId: null,
      }));
      const tools = createReadTools(createCtx(createMockDb({ foreshadowings })), NOVEL_ID);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.getForeshadowings as any).execute({});

      expect(res.count).toBe(MAX_STRUCTURE_ITEMS + 1);
      expect(res.truncated).toContain('showing 50 of 51');
      expect(res.foreshadowings).toHaveLength(MAX_STRUCTURE_ITEMS);
    });

    it('getTimelines - 51 件で 50 件に切り詰め、省略明示を含む', async () => {
      const timelines = Array.from({ length: MAX_STRUCTURE_ITEMS + 1 }, (_, i) => ({
        id: `timeline-${i + 1}`,
        novelId: NOVEL_ID,
        event: `イベント${i + 1}`,
        order: i + 1,
        timestamp: null,
        sectionId: null,
      }));
      const tools = createReadTools(createCtx(createMockDb({ timelines })), NOVEL_ID);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.getTimelines as any).execute({});

      expect(res.count).toBe(MAX_STRUCTURE_ITEMS + 1);
      expect(res.truncated).toContain('showing 50 of 51');
      expect(res.timelines).toHaveLength(MAX_STRUCTURE_ITEMS);
    });

    it('searchNovelKnowledge - 検索結果がカテゴリごとに 10 件に切り詰められる', async () => {
      vi.mocked(searchContext).mockResolvedValue({
        characters: Array.from({ length: 12 }, (_, i) => `人物テキスト${i + 1}`),
        settings: Array.from({ length: 12 }, (_, i) => `設定テキスト${i + 1}`),
      });

      const tools = createReadTools(createCtx(createMockDb({})), NOVEL_ID);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.searchNovelKnowledge as any).execute({ query: '魔法' });

      expect(res.characters).toHaveLength(MAX_SEARCH_ITEMS);
      expect(res.settings).toHaveLength(MAX_SEARCH_ITEMS);
      expect(res.truncated).toContain('showing 10 of 12');
    });
  });

  // ===== getSectionContent の novelId スコープ =====

  describe('getSectionContent の novelId スコープ', () => {
    const SECTION_ID = 'c1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c';
    const CHAPTER_ID = 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a';

    function setupDb(options: {
      boundNovelId: string | null;
      chapterNovelId: string;
      contentRow?: Row[];
    }) {
      return createMockDb({
        sections: [
          {
            id: SECTION_ID,
            chapterId: CHAPTER_ID,
            title: '冒頭の節',
            order: 1,
            summary: '節の要約',
          },
        ],
        contents: options.contentRow ?? [
          { id: 'content-1', sectionId: SECTION_ID, body: '本文テキストです。', wordCount: 9 },
        ],
        chapters: [
          {
            id: CHAPTER_ID,
            novelId: options.chapterNovelId,
            title: '第1章',
            order: 1,
            summary: null,
          },
        ],
      });
    }

    it('節の親章の novelId がバインドされた novelId と一致する場合、本文を返す', async () => {
      const tools = createReadTools(
        createCtx(setupDb({ boundNovelId: NOVEL_ID, chapterNovelId: NOVEL_ID })),
        NOVEL_ID,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.getSectionContent as any).execute({ sectionId: SECTION_ID });

      expect(res).toEqual({
        sectionId: SECTION_ID,
        title: '冒頭の節',
        summary: '節の要約',
        content: '本文テキストです。',
      });
    });

    it('節の親章の novelId が不一致の場合、エラーオブジェクトを返す', async () => {
      const tools = createReadTools(
        createCtx(setupDb({ boundNovelId: NOVEL_ID, chapterNovelId: OTHER_NOVEL_ID })),
        NOVEL_ID,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.getSectionContent as any).execute({ sectionId: SECTION_ID });

      expect(res).toHaveProperty('error');
      expect(String(res.error)).toContain('他の小説に属して');
    });

    it('バインドされた novelId がない場合、エラーオブジェクトを返す', async () => {
      const tools = createReadTools(
        createCtx(setupDb({ boundNovelId: null, chapterNovelId: NOVEL_ID })),
        null,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.getSectionContent as any).execute({ sectionId: SECTION_ID });

      expect(res).toEqual({ error: '対象の小説が指定されていません。' });
    });

    it('本文未作成の節では、未作成メッセージを返す', async () => {
      const tools = createReadTools(
        createCtx(
          setupDb({
            boundNovelId: NOVEL_ID,
            chapterNovelId: NOVEL_ID,
            contentRow: [],
          }),
        ),
        NOVEL_ID,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.getSectionContent as any).execute({ sectionId: SECTION_ID });

      expect(res).toEqual({
        sectionId: SECTION_ID,
        title: '冒頭の節',
        summary: '節の要約',
        content: '（本文はまだ作成されていません）',
      });
    });

    it('長い本文は 600 文字で切り詰められる', async () => {
      const longBody = '本'.repeat(MAX_TEXT_LENGTH + 20);
      const tools = createReadTools(
        createCtx(
          setupDb({
            boundNovelId: NOVEL_ID,
            chapterNovelId: NOVEL_ID,
            contentRow: [{ id: 'content-1', sectionId: SECTION_ID, body: longBody }],
          }),
        ),
        NOVEL_ID,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.getSectionContent as any).execute({ sectionId: SECTION_ID });

      expect(res.content.endsWith(TRUNCATION_SUFFIX)).toBe(true);
      expect(res.content.length).toBe(MAX_TEXT_LENGTH + TRUNCATION_SUFFIX.length);
    });
  });
});
