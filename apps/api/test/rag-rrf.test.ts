import type { VectorSearchResult } from "@novel-creator/vector";
import { describe, expect, it, vi } from "vitest";
import { searchContext } from "../src/rag.js";
import { pruneRanked, rrfMerge } from "../src/rag-prune.js";

vi.mock("@novel-creator/llm", () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

function makeResult(
  overrides: Partial<VectorSearchResult> & { content: string; id: string }
): VectorSearchResult {
  return {
    entityId: overrides.id,
    entityType: "character",
    score: 0.5,
    ...overrides,
  };
}

describe("rrfMerge", () => {
  it("両リストで上位の文書を最上位にすること", () => {
    const vectorHits = [
      makeResult({ content: "A", id: "a", score: 0.9 }),
      makeResult({ content: "B", id: "b", score: 0.85 }),
      makeResult({ content: "C", id: "c", score: 0.1 }),
    ];
    const ftsHits = [
      makeResult({ content: "B", id: "b", score: 0.95 }),
      makeResult({ content: "C", id: "c", score: 0.2 }),
    ];
    // B: 1/62 + 1/61 が最大。A はベクトルのみ、FTS 下位の C が A を上回る。
    const merged = rrfMerge(vectorHits, ftsHits, { topK: 3 });
    expect(merged.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("同一 id を1件に融合し score は両者の最大値を保持すること", () => {
    const merged = rrfMerge(
      [makeResult({ content: "A", id: "a", score: 0.9 })],
      [makeResult({ content: "A-fts", id: "a", score: 0.4 })],
      { topK: 5 }
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.score).toBe(0.9);
  });

  it("topK で打ち切ること", () => {
    const hits = ["a", "b", "c"].map((id) =>
      makeResult({ content: id, id, score: 0.5 })
    );
    expect(rrfMerge(hits, [], { topK: 2 })).toHaveLength(2);
    expect(rrfMerge([], [], { topK: 5 })).toEqual([]);
  });

  it("ベクトルのみでは拾えない別名文書を FTS 側から救済すること（recall 改善）", () => {
    // ベクトル上位は無関係文書のみ、FTS 1位が別名「星詠みのアストラ」文書。
    const vectorHits = [
      makeResult({ content: "無関係な街道の描写", id: "v1", score: 0.75 }),
      makeResult({ content: "無関係な酒場の描写", id: "v2", score: 0.74 }),
    ];
    const ftsHits = [
      makeResult({
        content: "星詠みのアストラは夜空で位置を割る",
        id: "alias-1",
        score: 0.6,
      }),
    ];
    const vectorOnly = pruneRanked(vectorHits, {
      queryTerms: ["アストラ"],
      topK: 1,
    });
    expect(vectorOnly.some((r) => r.content.includes("星詠み"))).toBe(false);

    const merged = rrfMerge(vectorHits, ftsHits, { topK: 3 });
    const pruned = pruneRanked(merged, {
      queryTerms: ["アストラ"],
      topK: 3,
    });
    expect(pruned.some((r) => r.content.includes("星詠み"))).toBe(true);
  });

  it("読み違い（表記揺れ）文書を FTS 側から救済すること", () => {
    const vectorHits = [
      makeResult({ content: "無関係な坑道の描写", id: "v1", score: 0.8 }),
    ];
    const ftsHits = [
      makeResult({
        content: "葬列トーマと連携する記録者モルテ",
        id: "yomi-1",
        score: 0.55,
      }),
    ];
    const merged = rrfMerge(vectorHits, ftsHits, { topK: 2 });
    expect(merged.some((r) => r.id === "yomi-1")).toBe(true);
  });
});

describe("searchContext ハイブリッド切替", () => {
  it("searchHybrid 対応ストアでは RRF 経路を使うこと", async () => {
    const searchHybrid = vi
      .fn()
      .mockImplementation(
        (_query: number[], _text: string, options: { entityType: string }) =>
          Promise.resolve({
            ftsHits: [
              makeResult({
                content: `FTS別名ヒット:${options.entityType} 星詠みのアストラ`,
                id: `fts-${options.entityType}`,
                score: 0.6,
              }),
            ],
            vectorHits: [
              makeResult({
                content: `ベクトルヒット:${options.entityType}`,
                id: `vec-${options.entityType}`,
                score: 0.9,
              }),
            ],
          })
      );
    const search = vi.fn();
    const store = { search, searchHybrid } as never;

    const result = await searchContext(
      store,
      {} as never,
      "novel-1",
      { query: "アストラ 星詠み", topK: 2 },
      { LLM_PROVIDER: "openai" } as never
    );

    expect(searchHybrid).toHaveBeenCalledTimes(5);
    expect(searchHybrid).toHaveBeenCalledWith(
      [0.1, 0.2, 0.3],
      "アストラ 星詠み",
      expect.objectContaining({ entityType: "character", novelId: "novel-1" })
    );
    expect(search).not.toHaveBeenCalled();
    expect(result.characters.join("")).toContain("FTS別名ヒット");
    // キーワード重なりで FTS 別名ヒットが先頭に再ランクされること
    expect(result.characters[0]).toContain("FTS別名ヒット");
  });

  it("Vectorize 相当（searchHybrid なし）では従来 search のままであること", async () => {
    const search = vi.fn().mockImplementation((_q: number[], options: never) =>
      Promise.resolve([
        makeResult({
          content: `従来ヒット:${(options as { entityType: string }).entityType}`,
          entityType: (options as { entityType: string }).entityType,
          id: "vec-1",
          score: 0.8,
        }),
      ])
    );
    const store = { search } as never;

    const result = await searchContext(
      store,
      {} as never,
      "novel-1",
      { query: "アストラ", topK: 2 },
      { LLM_PROVIDER: "openai" } as never
    );

    expect(search).toHaveBeenCalledTimes(5);
    expect(result.characters).toEqual(["従来ヒット:character"]);
  });

  it("searchHybrid 失敗時は search にフォールバックすること", async () => {
    const search = vi
      .fn()
      .mockResolvedValue([
        makeResult({ content: "フォールバックヒット", id: "fb-1", score: 0.8 }),
      ]);
    const store = {
      search,
      searchHybrid: vi.fn().mockRejectedValue(new Error("fts down")),
    } as never;

    const result = await searchContext(
      store,
      {} as never,
      "novel-1",
      { query: "アストラ", topK: 2 },
      { LLM_PROVIDER: "openai" } as never
    );

    expect(search).toHaveBeenCalledTimes(5);
    expect(result.characters).toEqual(["フォールバックヒット"]);
  });
});
