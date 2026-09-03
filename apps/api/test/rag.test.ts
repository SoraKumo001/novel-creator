import { describe, expect, it, vi } from "vitest";
import { searchContext, upsertEntityEmbedding } from "../src/rag.js";

vi.mock("@novel-creator/llm", () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

const searchContentByType: Record<string, string> = {
  character: "主人公アリス",
  content: "王都へ続く街道の場面",
  foreshadowing: "伏線: 王国の鍵 (unresolved)",
  setting: "王都ルミナス",
};

describe("rag.ts", () => {
  it("searchContext が minScore を渡して全エンティティタイプを検索すること", async () => {
    const mockVectorStore = {
      search: vi.fn().mockImplementation((_query, options) =>
        Promise.resolve([
          {
            content: searchContentByType[options.entityType] ?? "",
            entityId: "1",
            entityType: options.entityType,
            id: `${options.entityType}-1`,
            score: 0.8,
          },
        ])
      ),
    } as never;

    const mockEmbedding = {} as never;
    const mockEnv = { LLM_PROVIDER: "openai" } as never;

    const result = await searchContext(
      mockVectorStore,
      mockEmbedding,
      "novel-1",
      {
        minScore: 0.7,
        query: "アリスの旅立ち",
        topK: 3,
      },
      mockEnv
    );

    expect(result.characters).toEqual(["主人公アリス"]);
    expect(result.contents).toEqual(["王都へ続く街道の場面"]);
    expect(result.foreshadowings).toEqual(["伏線: 王国の鍵 (unresolved)"]);
    expect(result.settings).toEqual(["王都ルミナス"]);
    expect(mockVectorStore.search).toHaveBeenCalledWith([0.1, 0.2, 0.3], {
      entityType: "character",
      minScore: 0.7,
      novelId: "novel-1",
      topK: 3,
    });
    expect(mockVectorStore.search).toHaveBeenCalledWith([0.1, 0.2, 0.3], {
      entityType: "content",
      minScore: 0.7,
      novelId: "novel-1",
      topK: 3,
    });
    expect(mockVectorStore.search).toHaveBeenCalledWith([0.1, 0.2, 0.3], {
      entityType: "foreshadowing",
      minScore: 0.7,
      novelId: "novel-1",
      topK: 3,
    });
    expect(mockVectorStore.search).toHaveBeenCalledWith([0.1, 0.2, 0.3], {
      entityType: "setting",
      minScore: 0.7,
      novelId: "novel-1",
      topK: 3,
    });
  });

  it("searchContext が既定でエンティティタイプごとに検索上限を適用すること", async () => {
    const searchOptions: Array<{ entityType: string; topK: number }> = [];
    const mockVectorStore = {
      search: vi.fn().mockImplementation(async (_query, options) => {
        searchOptions.push(options);
        return [];
      }),
    } as never;

    const mockEmbedding = {} as never;
    const mockEnv = { LLM_PROVIDER: "openai" } as never;

    await searchContext(
      mockVectorStore,
      mockEmbedding,
      "novel-1",
      { query: "テスト" },
      mockEnv
    );

    expect(searchOptions).toEqual([
      expect.objectContaining({ entityType: "character", topK: 5 }),
      expect.objectContaining({ entityType: "content", topK: 3 }),
      expect.objectContaining({ entityType: "foreshadowing", topK: 5 }),
      expect.objectContaining({ entityType: "setting", topK: 5 }),
    ]);
  });

  it("upsertEntityEmbedding が既存削除後に登録を行うこと", async () => {
    const mockVectorStore = {
      deleteByEntity: vi.fn().mockResolvedValue(undefined),
      upsert: vi.fn().mockResolvedValue(undefined),
    } as never;

    const mockEmbedding = {} as never;
    const mockEnv = { LLM_PROVIDER: "openai" } as never;

    await upsertEntityEmbedding(
      mockVectorStore,
      mockEmbedding,
      "novel-1",
      "character",
      "char-1",
      "アリスの説明",
      mockEnv
    );

    expect(mockVectorStore.deleteByEntity).toHaveBeenCalledWith(
      "character",
      "char-1"
    );
    expect(mockVectorStore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "アリスの説明",
        embedding: [0.1, 0.2, 0.3],
        entityId: "char-1",
        entityType: "character",
        novelId: "novel-1",
      })
    );
  });
});
