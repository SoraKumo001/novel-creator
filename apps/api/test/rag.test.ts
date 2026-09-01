import { describe, expect, it, vi } from "vitest";
import { searchContext, upsertEntityEmbedding } from "../src/rag.js";

vi.mock("@novel-creator/llm", () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

describe("rag.ts", () => {
  it("searchContext が minScore を渡して検索を実行すること", async () => {
    const mockVectorStore = {
      search: vi.fn().mockImplementation((_query, options) => {
        if (options.entityType === "character") {
          return Promise.resolve([
            {
              content: "主人公アリス",
              entityId: "1",
              entityType: "character",
              id: "c1",
              score: 0.8,
            },
          ]);
        }
        return Promise.resolve([
          {
            content: "王都ルミナス",
            entityId: "2",
            entityType: "setting",
            id: "s1",
            score: 0.75,
          },
        ]);
      }),
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
    expect(result.settings).toEqual(["王都ルミナス"]);
    expect(mockVectorStore.search).toHaveBeenCalledWith([0.1, 0.2, 0.3], {
      entityType: "character",
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
