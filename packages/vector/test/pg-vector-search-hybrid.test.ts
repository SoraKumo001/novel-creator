import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- pg.Pool のモック（Phase3-3b ハイブリッド検索の SQL 検証用） ----
const mockQuery = vi.fn();

vi.mock("pg", () => {
  class MockPool {
    query = mockQuery;
    on() {}
    end() {}
  }
  return { Pool: MockPool };
});

import {
  createPgVectorStore,
  supportsHybridSearch,
} from "../src/pg-vector-store.js";

function sqlTextOf(call: unknown[]): string {
  const first = call[0] as { text?: string } | string | undefined;
  if (typeof first === "string") {
    return first;
  }
  return first?.text ?? "";
}

function callsContaining(fragment: string): unknown[][] {
  return mockQuery.mock.calls.filter((call) =>
    sqlTextOf(call).includes(fragment)
  );
}

function stubBase(dimensions: number | null): void {
  mockQuery.mockImplementation((...args: unknown[]) => {
    const text = sqlTextOf(args as unknown[]);
    if (text.includes("atttypmod")) {
      const rows = dimensions == null ? [] : [{ dimensions }];
      return Promise.resolve({ rowCount: rows.length, rows });
    }
    if (text.includes("similarity(")) {
      return Promise.resolve({
        rowCount: 1,
        rows: [
          {
            content: "星詠みのアストラは夜空で位置を割る",
            entityId: "33333333-3333-3333-3333-333333333333",
            entityType: "character",
            id: "11111111-1111-4111-8111-111111111111",
            metadata: null,
            rank: 0.5,
            sim: 0.4,
          },
        ],
      });
    }
    return Promise.resolve({ rowCount: 0, rows: [] });
  });
}

describe("searchHybrid（モック）", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("PG ストアが searchHybrid を備えること", () => {
    stubBase(1536);
    const store = createPgVectorStore("postgres://mock", 1536);
    expect(supportsHybridSearch(store)).toBe(true);
  });

  it("searchHybrid を持たないストアは false であること（Vectorize 分岐相当）", () => {
    expect(supportsHybridSearch({ search: async () => [] } as never)).toBe(
      false
    );
  });

  it("ベクトル側と FTS 側を並列取得し {vectorHits, ftsHits} を返すこと", async () => {
    mockQuery.mockImplementation((...args: unknown[]) => {
      const text = sqlTextOf(args as unknown[]);
      if (text.includes("atttypmod")) {
        return Promise.resolve({ rowCount: 1, rows: [{ dimensions: 1536 }] });
      }
      if (text.includes("similarity(")) {
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              content: "星詠みのアストラ",
              entityId: "33333333-3333-3333-3333-333333333333",
              entityType: "character",
              id: "fts-1",
              metadata: null,
              rank: 0.5,
              sim: 0.4,
            },
          ],
        });
      }
      // ベクトル側（drizzle select ビルダー）
      return Promise.resolve({
        rowCount: 1,
        rows: [
          [
            "ベクトル文書",
            0.2,
            "44444444-4444-4444-4444-444444444444",
            "character",
            "vec-1",
            null,
          ],
        ],
      });
    });
    const store = createPgVectorStore("postgres://mock", 1536);
    const hits = await store.searchHybrid([0.1, 0.2, 0.3], "アストラ", {
      entityType: "character",
      novelId: "22222222-2222-2222-2222-222222222222",
      topK: 5,
    });
    expect(hits.vectorHits).toHaveLength(1);
    expect(hits.vectorHits[0]?.id).toBe("vec-1");
    expect(hits.ftsHits).toHaveLength(1);
    expect(hits.ftsHits[0]?.id).toBe("fts-1");
    // FTS score は 0〜1 に正規化されること
    expect(hits.ftsHits[0]?.score).toBeGreaterThanOrEqual(0);
    expect(hits.ftsHits[0]?.score).toBeLessThanOrEqual(1);
  });

  it("FTS の SQL が ts_rank + trigram + LIKE と LIMIT 2*topK を含むこと", async () => {
    stubBase(1536);
    const store = createPgVectorStore("postgres://mock", 1536);
    await store.searchHybrid([0.1, 0.2, 0.3], "モルテ", { topK: 5 });
    const ftsCalls = callsContaining("plainto_tsquery");
    expect(ftsCalls.length).toBeGreaterThanOrEqual(1);
    const text = sqlTextOf(ftsCalls[0] as unknown[]);
    expect(text).toContain("ts_rank");
    expect(text).toContain("similarity(");
    expect(text).toContain("content %");
    expect(text).toContain("LIKE");
    expect(text).toContain("LIMIT");
    // 生成列を直接参照することで content_tsv GIN が効く
    expect(text).toContain("content_tsv");
  });

  it("novelId / entityType フィルタが FTS の SQL に含まれること", async () => {
    stubBase(1536);
    const store = createPgVectorStore("postgres://mock", 1536);
    await store.searchHybrid([0.1], "アストラ", {
      entityType: "character",
      novelId: "22222222-2222-2222-2222-222222222222",
      topK: 3,
    });
    const ftsCalls = callsContaining("plainto_tsquery");
    const text = sqlTextOf(ftsCalls[0] as unknown[]);
    expect(text).toContain("novel_id");
    expect(text).toContain("entity_type");
  });

  it("空クエリでは FTS 側が空配列であること", async () => {
    stubBase(1536);
    const store = createPgVectorStore("postgres://mock", 1536);
    const hits = await store.searchHybrid([0.1, 0.2, 0.3], "   ", {
      topK: 5,
    });
    expect(hits.ftsHits).toEqual([]);
    expect(callsContaining("plainto_tsquery")).toHaveLength(0);
  });

  it("pg_trgm 不可時は tsvector + LIKE に縮小して継続すること", async () => {
    let fullAttempts = 0;
    mockQuery.mockImplementation((...args: unknown[]) => {
      const text = sqlTextOf(args as unknown[]);
      if (text.includes("atttypmod")) {
        return Promise.resolve({ rowCount: 1, rows: [{ dimensions: 1536 }] });
      }
      if (text.includes("similarity(")) {
        fullAttempts += 1;
        return Promise.reject(
          new Error("function similarity(unknown, unknown) does not exist")
        );
      }
      if (text.includes("plainto_tsquery")) {
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              content: "縮小運用ヒット",
              entityId: "33333333-3333-3333-3333-333333333333",
              entityType: "character",
              id: "fb-1",
              metadata: null,
              rank: 0.3,
              sim: 0,
            },
          ],
        });
      }
      return Promise.resolve({ rowCount: 0, rows: [] });
    });
    const store = createPgVectorStore("postgres://mock", 1536);
    const hits = await store.searchHybrid([0.1], "アストラ", { topK: 3 });
    expect(fullAttempts).toBe(1);
    expect(hits.ftsHits).toHaveLength(1);
    expect(hits.ftsHits[0]?.content).toBe("縮小運用ヒット");
  });

  it("ensureSchema が FTS 用 DDL（content_tsv + GIN）を冪等発行すること", async () => {
    stubBase(1536);
    const store = createPgVectorStore("postgres://mock", 1536);
    await store.search([0.1, 0.2, 0.3], { topK: 1 });
    expect(callsContaining("content_tsv").length).toBeGreaterThanOrEqual(1);
    expect(
      callsContaining("vector_embeddings_content_tsv_idx").length
    ).toBeGreaterThanOrEqual(1);
    expect(callsContaining("pg_trgm").length).toBeGreaterThanOrEqual(1);
  });
});
