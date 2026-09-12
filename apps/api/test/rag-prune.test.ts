import type { VectorSearchResult } from "@novel-creator/vector";
import { describe, expect, it } from "vitest";
import { extractQueryTerms, pruneRanked } from "../src/rag-prune.js";

function makeResult(
  overrides: Partial<VectorSearchResult> & { content: string }
): VectorSearchResult {
  return {
    entityId: "e1",
    entityType: "character",
    id: "id-1",
    score: 0.8,
    ...overrides,
  };
}

describe("rag-prune.ts", () => {
  it("minScore 未満を足切りすること", () => {
    const cands = [
      makeResult({ entityId: "e1", id: "a", score: 0.9 }),
      makeResult({ entityId: "e2", id: "b", score: 0.1 }),
    ];
    const result = pruneRanked(cands, {
      minScore: 0.5,
      queryTerms: [],
      topK: 5,
    });
    expect(result.map((r) => r.entityId)).toEqual(["e1"]);
  });

  it("entityId の重複を除去すること", () => {
    const cands = [
      makeResult({ content: "first", entityId: "e1", id: "a", score: 0.9 }),
      makeResult({ content: "second", entityId: "e1", id: "b", score: 0.7 }),
    ];
    const result = pruneRanked(cands, { queryTerms: [], topK: 5 });
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("first");
  });

  it("キーワード重なりで再ランクし上位topKに絞ること", () => {
    const cands = [
      makeResult({ content: " unrelated text", entityId: "e1", score: 0.9 }),
      makeResult({
        content: "アリスの旅立ちの場面",
        entityId: "e2",
        score: 0.5,
      }),
    ];
    const result = pruneRanked(cands, {
      queryTerms: ["アリス", "旅立ち"],
      topK: 1,
    });
    expect(result).toHaveLength(1);
    expect(result[0].entityId).toBe("e2");
  });

  it("maxCharsPerItem で切り詰めること", () => {
    const cands = [makeResult({ content: "あいうえおかきくけこ", score: 0.9 })];
    const result = pruneRanked(cands, {
      maxCharsPerItem: 5,
      queryTerms: [],
      topK: 5,
    });
    expect(result[0].content).toBe("あいうえお…");
  });

  it("extractQueryTerms が2文字未満を除去し重複をまとめること", () => {
    expect(extractQueryTerms("アリス の 旅 アリス")).toEqual(["アリス"]);
  });
});
