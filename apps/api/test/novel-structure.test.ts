import { beforeEach, describe, expect, it, vi } from "vitest";

// LLM 呼び出しをモックし、プロンプト構築関数は引数を透過的に観察できるようにする
vi.mock("@novel-creator/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@novel-creator/llm")>();
  return {
    ...actual,
    analyzeStoryArcPrompt: vi.fn((args: unknown) => JSON.stringify(args)),
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4]),
    // 既定ではバッチ失敗（フォールバックで generateEmbedding 個別実行に切り替わる）。
    // 個別テストで mockReturnValueOnce により保留状態に差し替えられる。
    generateEmbeddings: vi
      .fn()
      .mockRejectedValue(new TypeError("mock: embedMany unavailable")),
    generateJSON: vi.fn().mockResolvedValue({ summary: "サマリー" }),
    multiPersonaReviewPrompt: vi.fn((args: unknown) => JSON.stringify(args)),
  };
});

import {
  chapters,
  characters,
  contents,
  type Database,
  embeddingConfigs,
  llmConfigs,
  novels,
  sections,
  settings,
} from "@novel-creator/db";
import {
  analyzeStoryArcPrompt,
  generateEmbedding,
  generateEmbeddings,
  multiPersonaReviewPrompt,
} from "@novel-creator/llm";
import {
  AnalysisDomainService,
  type AnalysisStreamEvent,
} from "../src/core/analysis.service.js";
import { fetchNovelStructureWithContents } from "../src/core/novel-structure.js";
import {
  ReindexDomainService,
  type ReindexProgressEvent,
  VectorStoreResetError,
} from "../src/core/reindex.service.js";
import type { ServiceContext } from "../src/core/types.js";

type Row = Record<string, unknown>;

/** テーブル参照 → フィクスチャキーの対応（同一モジュールインスタンスの同一性を利用） */
const TABLE_KEYS = [
  ["novels", novels],
  ["characters", characters],
  ["settings", settings],
  ["chapters", chapters],
  ["sections", sections],
  ["contents", contents],
  ["llmConfigs", llmConfigs],
  ["embeddingConfigs", embeddingConfigs],
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
    query.then = (
      resolve: (rows: Row[]) => unknown,
      reject: (reason?: unknown) => unknown
    ) => Promise.resolve(rows).then(resolve, reject);
    return query;
  };

  const db = {
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "saved-1" }]),
      }),
    })),
    select: vi.fn().mockImplementation((projection?: unknown) => ({
      from: vi.fn().mockImplementation((table: unknown) => {
        fromCalls.push(table);
        let rows = fixtureFor(table);
        if (
          table === contents &&
          projection !== undefined &&
          typeof projection === "object"
        ) {
          // snippet モード: DB 側 left(body, 300) の返り値をエミュレートする
          rows = rows.map((row) => ({
            ...row,
            body: String(row.body ?? "").slice(0, 300),
          }));
        }
        return makeQuery(rows);
      }),
    })),
  };

  const countFrom = (table: unknown) =>
    fromCalls.filter((called) => called === table).length;

  return { countFrom, db: db as unknown as Database, fromCalls };
}

function createVectorStore() {
  return {
    clearAll: vi.fn().mockResolvedValue(undefined),
    deleteByEntity: vi.fn().mockResolvedValue(undefined),
    deleteByNovel: vi.fn().mockResolvedValue(undefined),
    recreateSchema: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    upsertBatch: vi.fn().mockResolvedValue(undefined),
  };
}

function createContext(
  db: Database,
  vectorStore: ReturnType<typeof createVectorStore> = createVectorStore()
): ServiceContext {
  return {
    db,
    embedding: {} as never,
    env: {} as never,
    llm: {} as never,
    vectorStore: vectorStore as never,
  };
}

const NOVEL_A = { description: null, id: "n1", title: "小説A" };
const NOVEL_B = { description: null, id: "n2", title: "小説B" };

/** streamStoryArc / ヘルパ snippet テスト用。DB の返却順をわざと無秩序にしている */
const STORY_ARC_FIXTURE = {
  chapters: [
    { id: "c2", novelId: "n1", order: 2, title: "第2章" },
    { id: "c1", novelId: "n1", order: 1, title: "第1章" },
  ],
  characters: [],
  contents: [
    { body: "い".repeat(500), id: "ct2", sectionId: "s2" },
    { body: "あ".repeat(400), id: "ct1", sectionId: "s1" },
  ],
  embeddingConfigs: [],
  llmConfigs: [],
  novels: [NOVEL_A],
  sections: [
    { chapterId: "c1", id: "s3", order: 2, summary: null, title: null },
    { chapterId: "c1", id: "s1", order: 1, summary: "あらすじ1", title: "節1" },
    { chapterId: "c2", id: "s2", order: 1, summary: null, title: "節X" },
  ],
  settings: [],
};

/** reindex の複数小説バルク取得テスト用（登場人物・設定は空でコンテンツ系に集中） */
const REINDEX_MULTI_FIXTURE = {
  chapters: [
    { id: "c1", novelId: "n1", order: 2, title: "第1章" },
    { id: "c0", novelId: "n1", order: 1, title: "第0章" },
    { id: "c3", novelId: "n2", order: 1, title: "B第1章" },
  ],
  characters: [],
  contents: [
    { body: "あ", id: "ct1", sectionId: "s1" },
    { body: "   ", id: "ct2", sectionId: "s2" }, // 空白のみ → 除外される
    { body: "い", id: "ct3", sectionId: "s3" },
    // s4 は本文未作成 → 除外される
  ],
  embeddingConfigs: [],
  llmConfigs: [],
  novels: [NOVEL_A, NOVEL_B],
  sections: [
    { chapterId: "c0", id: "s2", order: 2, summary: null, title: "節A" },
    { chapterId: "c0", id: "s1", order: 1, summary: null, title: null },
    { chapterId: "c1", id: "s3", order: 1, summary: null, title: "節B" },
    { chapterId: "c3", id: "s4", order: 1, summary: null, title: null },
  ],
  settings: [],
};

/** reindex の単一小説・順序検証テスト用 */
const REINDEX_SINGLE_FIXTURE = {
  chapters: [
    { id: "c1", novelId: "n1", order: 2, title: "第1章" },
    { id: "c0", novelId: "n1", order: 1, title: "第0章" },
  ],
  characters: [
    {
      category: null,
      description: null,
      id: "chr1",
      name: "太郎",
      novelId: "n1",
      relationships: null,
      traits: null,
    },
  ],
  contents: [
    { body: "あ", id: "ct1", sectionId: "s1" },
    { body: "   ", id: "ct2", sectionId: "s2" },
    { body: "い", id: "ct3", sectionId: "s3" },
  ],
  embeddingConfigs: [],
  llmConfigs: [],
  novels: [NOVEL_A],
  sections: [
    { chapterId: "c0", id: "s2", order: 2, summary: null, title: "節A" },
    { chapterId: "c0", id: "s1", order: 1, summary: null, title: null },
    { chapterId: "c1", id: "s3", order: 1, summary: null, title: "節B" },
  ],
  settings: [],
};

/** persona-review（小説全体 / 章指定）テスト用 */
const PERSONA_FIXTURE = {
  chapters: [{ id: "c1", novelId: "n1", order: 1, title: "第1章" }],
  characters: [],
  contents: [
    { body: "結末の本文", id: "ct2", sectionId: "s2" },
    { body: "冒頭の本文", id: "ct1", sectionId: "s1" },
  ],
  embeddingConfigs: [],
  llmConfigs: [],
  novels: [NOVEL_A],
  sections: [
    { chapterId: "c1", id: "s2", order: 2, summary: null, title: null },
    { chapterId: "c1", id: "s1", order: 1, summary: null, title: "冒頭" },
  ],
  settings: [],
};

async function collectEvents(
  generator: AsyncGenerator<AnalysisStreamEvent, void, undefined>
) {
  const events: AnalysisStreamEvent[] = [];
  for await (const event of generator) {
    events.push(event);
  }
  return events;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchNovelStructureWithContents", () => {
  it("chapters / sections / contents を 3 クエリで取得し、章・節 order 昇順に組み立てる", async () => {
    const { db, countFrom } = createCountingDb(REINDEX_MULTI_FIXTURE);

    const structure = await fetchNovelStructureWithContents(db, ["n2", "n1"]);

    // N+1 解消の核心アサーション: 各テーブルへのクエリは 1 回ずつ
    expect(countFrom(chapters)).toBe(1);
    expect(countFrom(sections)).toBe(1);
    expect(countFrom(contents)).toBe(1);

    // 要求した小説 ID の順序を維持し、存在しない ID は空配列
    expect([...structure.keys()]).toEqual(["n2", "n1"]);

    // n1: 章 order 昇順（c0 → c1）、節 order 昇順（s1 → s2）
    const n1 = structure.get("n1") ?? [];
    expect(n1.map((node) => node.chapter.id)).toEqual(["c0", "c1"]);
    expect(n1[0]?.sections.map((s) => s.section.id)).toEqual(["s1", "s2"]);
    expect(n1[0]?.sections[0]?.body).toBe("あ");
    expect(n1[0]?.sections[1]?.body).toBe("   ");
    expect(n1[1]?.sections.map((s) => s.section.id)).toEqual(["s3"]);
    expect(n1[1]?.sections[0]?.body).toBe("い");

    // n2: 本文未作成の節は body が null
    const n2 = structure.get("n2") ?? [];
    expect(n2.map((node) => node.chapter.id)).toEqual(["c3"]);
    expect(n2[0]?.sections[0]?.body).toBeNull();
  });

  it("snippet モードでは DB 側で切り詰められた本文（left(body, N)）を受け取る", async () => {
    const { db, countFrom } = createCountingDb(STORY_ARC_FIXTURE);

    const structure = await fetchNovelStructureWithContents(db, ["n1"], {
      contentMode: "snippet",
      snippetLength: 300,
    });

    expect(countFrom(chapters)).toBe(1);
    expect(countFrom(sections)).toBe(1);
    expect(countFrom(contents)).toBe(1);

    const n1 = structure.get("n1") ?? [];
    expect(n1[0]?.sections[0]?.body).toBe("あ".repeat(300)); // 400 文字 → 300 文字
    expect(n1[0]?.sections[1]?.body).toBeNull(); // 本文なし
    expect(n1[1]?.sections[0]?.body).toBe("い".repeat(300)); // 500 文字 → 300 文字
  });

  it("contentMode='none' では contents にクエリを発行しない（2 クエリ）", async () => {
    const { db, countFrom } = createCountingDb(REINDEX_MULTI_FIXTURE);

    const structure = await fetchNovelStructureWithContents(db, ["n1"], {
      contentMode: "none",
    });

    expect(countFrom(chapters)).toBe(1);
    expect(countFrom(sections)).toBe(1);
    expect(countFrom(contents)).toBe(0);

    const n1 = structure.get("n1") ?? [];
    expect(n1.map((node) => node.chapter.id)).toEqual(["c0", "c1"]);
    expect(n1.flatMap((node) => node.sections.map((s) => s.body))).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("空の novelIds ではクエリを発行しない", async () => {
    const { db, countFrom } = createCountingDb(REINDEX_MULTI_FIXTURE);

    const structure = await fetchNovelStructureWithContents(db, []);

    expect(structure.size).toBe(0);
    expect(countFrom(chapters)).toBe(0);
    expect(countFrom(sections)).toBe(0);
    expect(countFrom(contents)).toBe(0);
  });
});

describe("AnalysisDomainService.streamStoryArc", () => {
  it("章・節・本文を 3 クエリで取得し、プロンプトの構造・順序・スニペットが従来と一致する", async () => {
    const { db, countFrom, fromCalls } = createCountingDb(STORY_ARC_FIXTURE);
    const service = new AnalysisDomainService(createContext(db));

    const events = await collectEvents(service.streamStoryArc("n1"));

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
    expect(promptArg.novelTitle).toBe("小説A");
    expect(promptArg.chapters).toEqual([
      {
        id: "c1",
        sections: [
          {
            contentSnippet: "あ".repeat(300),
            id: "s1",
            summary: "あらすじ1",
            title: "節1",
          },
          { contentSnippet: undefined, id: "s3", summary: null, title: "節 2" },
        ],
        title: "第1章",
      },
      {
        id: "c2",
        sections: [
          {
            contentSnippet: "い".repeat(300),
            id: "s2",
            summary: null,
            title: "節X",
          },
        ],
        title: "第2章",
      },
    ]);

    // ストリームイベントの形状・順序も従来と同一
    expect(events).toEqual([
      { current: 1, stage: "章・節の本文を収集中", total: 2, type: "progress" },
      { current: 2, stage: "章・節の本文を収集中", total: 2, type: "progress" },
      { current: 0, stage: "分析結果を保存中", total: 0, type: "progress" },
      { result: { summary: "サマリー" }, savedId: "saved-1", type: "complete" },
    ]);
  });
});

describe("AnalysisDomainService.streamPersonaReview", () => {
  it("節・章・本文の指定がない場合、小説全体本文を 3 クエリで章→節順に結合する", async () => {
    const { db, countFrom } = createCountingDb(PERSONA_FIXTURE);
    const service = new AnalysisDomainService(createContext(db));

    const events = await collectEvents(service.streamPersonaReview("n1", {}));

    expect(countFrom(chapters)).toBe(1);
    expect(countFrom(sections)).toBe(1);
    expect(countFrom(contents)).toBe(1);

    const promptArg = vi.mocked(multiPersonaReviewPrompt).mock
      .calls[0]?.[0] as {
      novelTitle: string;
      text: string;
    };
    expect(promptArg).toEqual({
      chapterTitle: undefined,
      novelTitle: "小説A",
      sectionTitle: undefined,
      text: "【第1章 / 冒頭】\n冒頭の本文\n\n【第1章 / 節 2】\n結末の本文",
    });

    expect(events.at(-1)).toEqual({
      result: { summary: "サマリー" },
      savedId: "saved-1",
      type: "complete",
    });
  });

  it("章指定の場合、章内の節本文を 3 クエリで収集する（節ごとの個別 SELECT を解消）", async () => {
    const { db, countFrom } = createCountingDb(PERSONA_FIXTURE);
    const service = new AnalysisDomainService(createContext(db));

    await collectEvents(service.streamPersonaReview("n1", { chapterId: "c1" }));

    expect(countFrom(chapters)).toBe(2); // 章の個別取得 + ヘルパの chapters 取得
    expect(countFrom(sections)).toBe(1);
    expect(countFrom(contents)).toBe(1);

    const promptArg = vi.mocked(multiPersonaReviewPrompt).mock
      .calls[0]?.[0] as {
      chapterTitle?: string;
      text: string;
    };
    expect(promptArg.chapterTitle).toBe("第1章");
    expect(promptArg.text).toBe("【冒頭】\n冒頭の本文\n\n【節 2】\n結末の本文");
  });
});

describe("ReindexDomainService.reindexAll", () => {
  it("複数小説の章・節・本文を 3 クエリで収集し、従来と同じ内容でベクトル化する", async () => {
    const { db, countFrom } = createCountingDb(REINDEX_MULTI_FIXTURE);
    const vectorStore = createVectorStore();
    const service = new ReindexDomainService(createContext(db, vectorStore));

    const result = await service.reindexAll();

    // クエリ数アサーション: 小説が 2 冊あっても章・節・本文はそれぞれ 1 回
    // （従来は chapters 2 回 + sections 3 回 + contents 3 回）
    expect(countFrom(chapters)).toBe(1);
    expect(countFrom(sections)).toBe(1);
    expect(countFrom(contents)).toBe(1);

    expect(result).toEqual({ dimensions: 1536, totalIndexed: 2 });
    expect(vectorStore.recreateSchema).toHaveBeenCalledWith(1536);

    // upsert されたレコード（title は VectorRecord に含まれず進捗表示用のみ）:
    // 本文は空白のみ・未作成の節が除外され、order 昇順
    const records = (vectorStore.upsertBatch.mock.calls[0]?.[0] ?? []) as Array<
      { id: string } & Row
    >;
    expect(records.map(({ id: _id, ...rest }) => rest)).toEqual([
      {
        content: "あ",
        embedding: [0.1, 0.2, 0.3, 0.4],
        entityId: "s1",
        entityType: "content",
        novelId: "n1",
      },
      {
        content: "い",
        embedding: [0.1, 0.2, 0.3, 0.4],
        entityId: "s3",
        entityType: "content",
        novelId: "n1",
      },
    ]);
  });

  it("単一小説でも人物 → 本文の順序と除外条件が従来と一致する", async () => {
    const { db, countFrom } = createCountingDb(REINDEX_SINGLE_FIXTURE);
    const vectorStore = createVectorStore();
    const service = new ReindexDomainService(createContext(db, vectorStore));

    const result = await service.reindexAll();

    expect(countFrom(chapters)).toBe(1);
    expect(countFrom(sections)).toBe(1);
    expect(countFrom(contents)).toBe(1);

    expect(result).toEqual({ dimensions: 1536, totalIndexed: 3 });

    const records = (vectorStore.upsertBatch.mock.calls[0]?.[0] ?? []) as Array<
      { id: string } & Row
    >;
    expect(records.map(({ id: _id, ...rest }) => rest)).toEqual([
      {
        content: "名前: 太郎",
        embedding: [0.1, 0.2, 0.3, 0.4],
        entityId: "chr1",
        entityType: "character",
        novelId: "n1",
      },
      {
        content: "あ",
        embedding: [0.1, 0.2, 0.3, 0.4],
        entityId: "s1",
        entityType: "content",
        novelId: "n1",
      },
      {
        content: "い",
        embedding: [0.1, 0.2, 0.3, 0.4],
        entityId: "s3",
        entityType: "content",
        novelId: "n1",
      },
    ]);

    // 埋め込み呼び出しも itemsToEmbed と同じ順序
    expect(
      vi.mocked(generateEmbedding).mock.calls.map(([, content]) => content)
    ).toEqual(["名前: 太郎", "あ", "い"]);
  });

  it("recreateSchema も clearAll も持たないストアでは VectorStoreResetError を投げること", async () => {
    const { db } = createCountingDb(REINDEX_MULTI_FIXTURE);
    const vectorStore = {
      deleteByEntity: vi.fn().mockResolvedValue(undefined),
      deleteByNovel: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
      upsertBatch: vi.fn().mockResolvedValue(undefined),
    };
    const service = new ReindexDomainService(createContext(db, vectorStore));

    // クリア手段がないストアで reindex すると stale ベクトルが蓄積するため、
    // 黙ってスキップせず明示的に失敗する。
    await expect(service.reindexAll()).rejects.toThrow(VectorStoreResetError);
    expect(vectorStore.upsertBatch).not.toHaveBeenCalled();
  });

  it("埋め込みの完了前に、バッチ開始時点の進捗イベントを送出すること", async () => {
    const { db } = createCountingDb(REINDEX_SINGLE_FIXTURE);
    const vectorStore = createVectorStore();
    const service = new ReindexDomainService(createContext(db, vectorStore));

    // 1 バッチ目を保留状態にし、埋め込み解決前でも進捗が届くことを検証する
    let resolveEmbeddings!: (value: number[][]) => void;
    const pendingEmbeddings = new Promise<number[][]>((resolve) => {
      resolveEmbeddings = resolve;
    });
    vi.mocked(generateEmbeddings).mockReturnValueOnce(pendingEmbeddings);

    const events: ReindexProgressEvent[] = [];
    const reindexPromise = service.reindexAll(undefined, (event) =>
      events.push(event)
    );

    // 埋め込みがまだ解決していなくても、バッチ開始時点のイベントが届く
    await vi.waitFor(() => {
      expect(
        events.some(
          (event) =>
            event.stage === "データをベクトル化中... (0/3)" &&
            event.current === 0 &&
            event.total === 3
        )
      ).toBe(true);
    });

    // 保留を解除すると処理が最後まで完了する
    resolveEmbeddings!([
      [0.1, 0.2, 0.3, 0.4],
      [0.1, 0.2, 0.3, 0.4],
      [0.1, 0.2, 0.3, 0.4],
    ]);
    const result = await reindexPromise;
    expect(result).toEqual({ dimensions: 1536, totalIndexed: 3 });
    expect(events.at(-1)).toEqual({
      current: 3,
      percent: 100,
      stage: "全 3 件のインデックス再構築が完了しました",
      total: 3,
    });
  });
});
