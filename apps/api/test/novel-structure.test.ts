import { beforeEach, describe, expect, it, vi } from 'vitest';

// LLM 呼び出しをモックし、プロンプト構築関数は引数を透過的に観察できるようにする
vi.mock('@novel-creator/llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@novel-creator/llm')>();
  return {
    ...actual,
    analyzeStoryArcPrompt: vi.fn((args: unknown) => JSON.stringify(args)),
    multiPersonaReviewPrompt: vi.fn((args: unknown) => JSON.stringify(args)),
    generateJSON: vi.fn().mockResolvedValue({ summary: 'サマリー' }),
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4]),
  };
});

import {
  chapters,
  characters,
  contents,
  embeddingConfigs,
  llmConfigs,
  novels,
  sections,
  settings,
  type Database,
} from '@novel-creator/db';
import {
  analyzeStoryArcPrompt,
  generateEmbedding,
  multiPersonaReviewPrompt,
} from '@novel-creator/llm';
import { AnalysisDomainService, type AnalysisStreamEvent } from '../src/core/analysis.service.js';
import { fetchNovelStructureWithContents } from '../src/core/novel-structure.js';
import { ReindexDomainService } from '../src/core/reindex.service.js';
import type { ServiceContext } from '../src/core/types.js';

type Row = Record<string, unknown>;

/** テーブル参照 → フィクスチャキーの対応（同一モジュールインスタンスの同一性を利用） */
const TABLE_KEYS = [
  ['novels', novels],
  ['characters', characters],
  ['settings', settings],
  ['chapters', chapters],
  ['sections', sections],
  ['contents', contents],
  ['llmConfigs', llmConfigs],
  ['embeddingConfigs', embeddingConfigs],
] as const;

/**
 * from(table) の呼び出し回数を記録し、テーブル参照に応じてフィクスチャ行を返すモック DB。
 * select に射影（引数あり）が渡されて contents を取得する場合は、
 * SQL の left(body, 300) をエミュレートして本文を切り詰めて返す。
 */
function createCountingDb(fixture: Record<string, Row[]>) {
  const fromCalls: unknown[] = [];

  const fixtureFor = (table: unknown): Row[] => {
    for (const [key, tableObj] of TABLE_KEYS) {
      if (table === tableObj) {
        return fixture[key] ?? [];
      }
    }
    return [];
  };

  const makeQuery = (rows: Row[]) => {
    const query: Record<string, unknown> = {};
    query.where = vi.fn().mockReturnValue(query);
    query.orderBy = vi.fn().mockReturnValue(query);
    query.limit = vi.fn().mockReturnValue(query);
    query.then = (resolve: (rows: Row[]) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject);
    return query;
  };

  const db = {
    select: vi.fn().mockImplementation((projection?: unknown) => ({
      from: vi.fn().mockImplementation((table: unknown) => {
        fromCalls.push(table);
        let rows = fixtureFor(table);
        if (table === contents && projection !== undefined && typeof projection === 'object') {
          // snippet モード: DB 側 left(body, 300) の返り値をエミュレートする
          rows = rows.map((row) => ({ ...row, body: String(row.body ?? '').slice(0, 300) }));
        }
        return makeQuery(rows);
      }),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'saved-1' }]),
      }),
    })),
  };

  const countFrom = (table: unknown) => fromCalls.filter((called) => called === table).length;

  return { db: db as unknown as Database, countFrom, fromCalls };
}

function createVectorStore() {
  return {
    recreateSchema: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn().mockResolvedValue(undefined),
    upsertBatch: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    deleteByNovel: vi.fn().mockResolvedValue(undefined),
    deleteByEntity: vi.fn().mockResolvedValue(undefined),
  };
}

function createContext(
  db: Database,
  vectorStore: ReturnType<typeof createVectorStore> = createVectorStore(),
): ServiceContext {
  return {
    db,
    llm: {} as never,
    embedding: {} as never,
    vectorStore: vectorStore as never,
    env: {} as never,
  };
}

const NOVEL_A = { id: 'n1', title: '小説A', description: null };
const NOVEL_B = { id: 'n2', title: '小説B', description: null };

/** streamStoryArc / ヘルパ snippet テスト用。DB の返却順をわざと無秩序にしている */
const STORY_ARC_FIXTURE = {
  novels: [NOVEL_A],
  characters: [],
  settings: [],
  chapters: [
    { id: 'c2', novelId: 'n1', title: '第2章', order: 2 },
    { id: 'c1', novelId: 'n1', title: '第1章', order: 1 },
  ],
  sections: [
    { id: 's3', chapterId: 'c1', title: null, order: 2, summary: null },
    { id: 's1', chapterId: 'c1', title: '節1', order: 1, summary: 'あらすじ1' },
    { id: 's2', chapterId: 'c2', title: '節X', order: 1, summary: null },
  ],
  contents: [
    { id: 'ct2', sectionId: 's2', body: 'い'.repeat(500) },
    { id: 'ct1', sectionId: 's1', body: 'あ'.repeat(400) },
  ],
  llmConfigs: [],
  embeddingConfigs: [],
};

/** reindex の複数小説バルク取得テスト用（登場人物・設定は空でコンテンツ系に集中） */
const REINDEX_MULTI_FIXTURE = {
  novels: [NOVEL_A, NOVEL_B],
  characters: [],
  settings: [],
  chapters: [
    { id: 'c1', novelId: 'n1', title: '第1章', order: 2 },
    { id: 'c0', novelId: 'n1', title: '第0章', order: 1 },
    { id: 'c3', novelId: 'n2', title: 'B第1章', order: 1 },
  ],
  sections: [
    { id: 's2', chapterId: 'c0', title: '節A', order: 2, summary: null },
    { id: 's1', chapterId: 'c0', title: null, order: 1, summary: null },
    { id: 's3', chapterId: 'c1', title: '節B', order: 1, summary: null },
    { id: 's4', chapterId: 'c3', title: null, order: 1, summary: null },
  ],
  contents: [
    { id: 'ct1', sectionId: 's1', body: 'あ' },
    { id: 'ct2', sectionId: 's2', body: '   ' }, // 空白のみ → 除外される
    { id: 'ct3', sectionId: 's3', body: 'い' },
    // s4 は本文未作成 → 除外される
  ],
  llmConfigs: [],
  embeddingConfigs: [],
};

/** reindex の単一小説・順序検証テスト用 */
const REINDEX_SINGLE_FIXTURE = {
  novels: [NOVEL_A],
  characters: [
    {
      id: 'chr1',
      novelId: 'n1',
      name: '太郎',
      category: null,
      description: null,
      traits: null,
      relationships: null,
    },
  ],
  settings: [],
  chapters: [
    { id: 'c1', novelId: 'n1', title: '第1章', order: 2 },
    { id: 'c0', novelId: 'n1', title: '第0章', order: 1 },
  ],
  sections: [
    { id: 's2', chapterId: 'c0', title: '節A', order: 2, summary: null },
    { id: 's1', chapterId: 'c0', title: null, order: 1, summary: null },
    { id: 's3', chapterId: 'c1', title: '節B', order: 1, summary: null },
  ],
  contents: [
    { id: 'ct1', sectionId: 's1', body: 'あ' },
    { id: 'ct2', sectionId: 's2', body: '   ' },
    { id: 'ct3', sectionId: 's3', body: 'い' },
  ],
  llmConfigs: [],
  embeddingConfigs: [],
};

/** persona-review（小説全体 / 章指定）テスト用 */
const PERSONA_FIXTURE = {
  novels: [NOVEL_A],
  characters: [],
  settings: [],
  chapters: [{ id: 'c1', novelId: 'n1', title: '第1章', order: 1 }],
  sections: [
    { id: 's2', chapterId: 'c1', title: null, order: 2, summary: null },
    { id: 's1', chapterId: 'c1', title: '冒頭', order: 1, summary: null },
  ],
  contents: [
    { id: 'ct2', sectionId: 's2', body: '結末の本文' },
    { id: 'ct1', sectionId: 's1', body: '冒頭の本文' },
  ],
  llmConfigs: [],
  embeddingConfigs: [],
};

async function collectEvents(generator: AsyncGenerator<AnalysisStreamEvent, void, undefined>) {
  const events: AnalysisStreamEvent[] = [];
  for await (const event of generator) {
    events.push(event);
  }
  return events;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchNovelStructureWithContents', () => {
  it('chapters / sections / contents を 3 クエリで取得し、章・節 order 昇順に組み立てる', async () => {
    const { db, countFrom } = createCountingDb(REINDEX_MULTI_FIXTURE);

    const structure = await fetchNovelStructureWithContents(db, ['n2', 'n1']);

    // N+1 解消の核心アサーション: 各テーブルへのクエリは 1 回ずつ
    expect(countFrom(chapters)).toBe(1);
    expect(countFrom(sections)).toBe(1);
    expect(countFrom(contents)).toBe(1);

    // 要求した小説 ID の順序を維持し、存在しない ID は空配列
    expect([...structure.keys()]).toEqual(['n2', 'n1']);

    // n1: 章 order 昇順（c0 → c1）、節 order 昇順（s1 → s2）
    const n1 = structure.get('n1') ?? [];
    expect(n1.map((node) => node.chapter.id)).toEqual(['c0', 'c1']);
    expect(n1[0]?.sections.map((s) => s.section.id)).toEqual(['s1', 's2']);
    expect(n1[0]?.sections[0]?.body).toBe('あ');
    expect(n1[0]?.sections[1]?.body).toBe('   ');
    expect(n1[1]?.sections.map((s) => s.section.id)).toEqual(['s3']);
    expect(n1[1]?.sections[0]?.body).toBe('い');

    // n2: 本文未作成の節は body が null
    const n2 = structure.get('n2') ?? [];
    expect(n2.map((node) => node.chapter.id)).toEqual(['c3']);
    expect(n2[0]?.sections[0]?.body).toBeNull();
  });

  it('snippet モードでは DB 側で切り詰められた本文（left(body, N)）を受け取る', async () => {
    const { db, countFrom } = createCountingDb(STORY_ARC_FIXTURE);

    const structure = await fetchNovelStructureWithContents(db, ['n1'], {
      contentMode: 'snippet',
      snippetLength: 300,
    });

    expect(countFrom(chapters)).toBe(1);
    expect(countFrom(sections)).toBe(1);
    expect(countFrom(contents)).toBe(1);

    const n1 = structure.get('n1') ?? [];
    expect(n1[0]?.sections[0]?.body).toBe('あ'.repeat(300)); // 400 文字 → 300 文字
    expect(n1[0]?.sections[1]?.body).toBeNull(); // 本文なし
    expect(n1[1]?.sections[0]?.body).toBe('い'.repeat(300)); // 500 文字 → 300 文字
  });

  it("contentMode='none' では contents にクエリを発行しない（2 クエリ）", async () => {
    const { db, countFrom } = createCountingDb(REINDEX_MULTI_FIXTURE);

    const structure = await fetchNovelStructureWithContents(db, ['n1'], {
      contentMode: 'none',
    });

    expect(countFrom(chapters)).toBe(1);
    expect(countFrom(sections)).toBe(1);
    expect(countFrom(contents)).toBe(0);

    const n1 = structure.get('n1') ?? [];
    expect(n1.map((node) => node.chapter.id)).toEqual(['c0', 'c1']);
    expect(n1.flatMap((node) => node.sections.map((s) => s.body))).toEqual([null, null, null]);
  });

  it('空の novelIds ではクエリを発行しない', async () => {
    const { db, countFrom } = createCountingDb(REINDEX_MULTI_FIXTURE);

    const structure = await fetchNovelStructureWithContents(db, []);

    expect(structure.size).toBe(0);
    expect(countFrom(chapters)).toBe(0);
    expect(countFrom(sections)).toBe(0);
    expect(countFrom(contents)).toBe(0);
  });
});

describe('AnalysisDomainService.streamStoryArc', () => {
  it('章・節・本文を 3 クエリで取得し、プロンプトの構造・順序・スニペットが従来と一致する', async () => {
    const { db, countFrom, fromCalls } = createCountingDb(STORY_ARC_FIXTURE);
    const service = new AnalysisDomainService(createContext(db));

    const events = await collectEvents(service.streamStoryArc('n1'));

    // クエリ数アサーション: 章・節・本文がそれぞれ 1 回（N+1 解消）
    expect(countFrom(chapters)).toBe(1);
    expect(countFrom(sections)).toBe(1);
    expect(countFrom(contents)).toBe(1);
    // select 系クエリ全体: novels + chapters + sections + contents + llmConfigs(既定モデル解決)
    expect(fromCalls).toHaveLength(5);

    // プロンプト引数: 章順序・節順序・スニペット（300 文字）・本文なし節は undefined
    const promptArg = vi.mocked(analyzeStoryArcPrompt).mock.calls[0]?.[0] as {
      novelTitle: string;
      chapters: Array<{
        id: string;
        title: string;
        sections: Array<{
          id: string;
          title: string;
          summary: string | null;
          contentSnippet?: string;
        }>;
      }>;
    };
    expect(promptArg.novelTitle).toBe('小説A');
    expect(promptArg.chapters).toEqual([
      {
        id: 'c1',
        title: '第1章',
        sections: [
          { id: 's1', title: '節1', summary: 'あらすじ1', contentSnippet: 'あ'.repeat(300) },
          { id: 's3', title: '節 2', summary: null, contentSnippet: undefined },
        ],
      },
      {
        id: 'c2',
        title: '第2章',
        sections: [{ id: 's2', title: '節X', summary: null, contentSnippet: 'い'.repeat(300) }],
      },
    ]);

    // ストリームイベントの形状・順序も従来と同一
    expect(events).toEqual([
      { type: 'progress', stage: '章・節の本文を収集中', current: 1, total: 2 },
      { type: 'progress', stage: '章・節の本文を収集中', current: 2, total: 2 },
      { type: 'progress', stage: '分析結果を保存中', current: 0, total: 0 },
      { type: 'complete', result: { summary: 'サマリー' }, savedId: 'saved-1' },
    ]);
  });
});

describe('AnalysisDomainService.streamPersonaReview', () => {
  it('節・章・本文の指定がない場合、小説全体本文を 3 クエリで章→節順に結合する', async () => {
    const { db, countFrom } = createCountingDb(PERSONA_FIXTURE);
    const service = new AnalysisDomainService(createContext(db));

    const events = await collectEvents(service.streamPersonaReview('n1', {}));

    expect(countFrom(chapters)).toBe(1);
    expect(countFrom(sections)).toBe(1);
    expect(countFrom(contents)).toBe(1);

    const promptArg = vi.mocked(multiPersonaReviewPrompt).mock.calls[0]?.[0] as {
      novelTitle: string;
      text: string;
    };
    expect(promptArg).toEqual({
      novelTitle: '小説A',
      chapterTitle: undefined,
      sectionTitle: undefined,
      text: '【第1章 / 冒頭】\n冒頭の本文\n\n【第1章 / 節 2】\n結末の本文',
    });

    expect(events[events.length - 1]).toEqual({
      type: 'complete',
      result: { summary: 'サマリー' },
      savedId: 'saved-1',
    });
  });

  it('章指定の場合、章内の節本文を 3 クエリで収集する（節ごとの個別 SELECT を解消）', async () => {
    const { db, countFrom } = createCountingDb(PERSONA_FIXTURE);
    const service = new AnalysisDomainService(createContext(db));

    await collectEvents(service.streamPersonaReview('n1', { chapterId: 'c1' }));

    expect(countFrom(chapters)).toBe(2); // 章の個別取得 + ヘルパの chapters 取得
    expect(countFrom(sections)).toBe(1);
    expect(countFrom(contents)).toBe(1);

    const promptArg = vi.mocked(multiPersonaReviewPrompt).mock.calls[0]?.[0] as {
      chapterTitle?: string;
      text: string;
    };
    expect(promptArg.chapterTitle).toBe('第1章');
    expect(promptArg.text).toBe('【冒頭】\n冒頭の本文\n\n【節 2】\n結末の本文');
  });
});

describe('ReindexDomainService.reindexAll', () => {
  it('複数小説の章・節・本文を 3 クエリで収集し、従来と同じ内容でベクトル化する', async () => {
    const { db, countFrom } = createCountingDb(REINDEX_MULTI_FIXTURE);
    const vectorStore = createVectorStore();
    const service = new ReindexDomainService(createContext(db, vectorStore));

    const result = await service.reindexAll();

    // クエリ数アサーション: 小説が 2 冊あっても章・節・本文はそれぞれ 1 回
    // （従来は chapters 2 回 + sections 3 回 + contents 3 回）
    expect(countFrom(chapters)).toBe(1);
    expect(countFrom(sections)).toBe(1);
    expect(countFrom(contents)).toBe(1);

    expect(result).toEqual({ totalIndexed: 2, dimensions: 1536 });
    expect(vectorStore.recreateSchema).toHaveBeenCalledWith(1536);

    // upsert されたレコード（title は VectorRecord に含まれず進捗表示用のみ）:
    // 本文は空白のみ・未作成の節が除外され、order 昇順
    const records = (vectorStore.upsertBatch.mock.calls[0]?.[0] ?? []) as Array<
      { id: string } & Row
    >;
    expect(records.map(({ id: _id, ...rest }) => rest)).toEqual([
      {
        novelId: 'n1',
        entityType: 'content',
        entityId: 's1',
        content: 'あ',
        embedding: [0.1, 0.2, 0.3, 0.4],
      },
      {
        novelId: 'n1',
        entityType: 'content',
        entityId: 's3',
        content: 'い',
        embedding: [0.1, 0.2, 0.3, 0.4],
      },
    ]);
  });

  it('単一小説でも人物 → 本文の順序と除外条件が従来と一致する', async () => {
    const { db, countFrom } = createCountingDb(REINDEX_SINGLE_FIXTURE);
    const vectorStore = createVectorStore();
    const service = new ReindexDomainService(createContext(db, vectorStore));

    const result = await service.reindexAll();

    expect(countFrom(chapters)).toBe(1);
    expect(countFrom(sections)).toBe(1);
    expect(countFrom(contents)).toBe(1);

    expect(result).toEqual({ totalIndexed: 3, dimensions: 1536 });

    const records = (vectorStore.upsertBatch.mock.calls[0]?.[0] ?? []) as Array<
      { id: string } & Row
    >;
    expect(records.map(({ id: _id, ...rest }) => rest)).toEqual([
      {
        novelId: 'n1',
        entityType: 'character',
        entityId: 'chr1',
        content: '名前: 太郎',
        embedding: [0.1, 0.2, 0.3, 0.4],
      },
      {
        novelId: 'n1',
        entityType: 'content',
        entityId: 's1',
        content: 'あ',
        embedding: [0.1, 0.2, 0.3, 0.4],
      },
      {
        novelId: 'n1',
        entityType: 'content',
        entityId: 's3',
        content: 'い',
        embedding: [0.1, 0.2, 0.3, 0.4],
      },
    ]);

    // 埋め込み呼び出しも itemsToEmbed と同じ順序
    expect(vi.mocked(generateEmbedding).mock.calls.map(([, content]) => content)).toEqual([
      '名前: 太郎',
      'あ',
      'い',
    ]);
  });
});
