import { describe, expect, it, vi } from "vitest";
import { generateEmbedding, generateEmbeddings } from "../src/embeddings.js";
import { createEmbeddingModel, createLanguageModel } from "../src/provider.js";
import {
  createWorkersAIEmbeddingModel,
  createWorkersAILanguageModel,
  DEFAULT_WORKERS_AI_EMBEDDING_MODEL,
  type WorkersAiBinding,
} from "../src/workers-ai.js";

describe("Workers AI Embedding Adapter", () => {
  it("Workers AI の data 配列レスポンスから embedding を正常に取得できること", async () => {
    const mockVector = new Array(1024).fill(0.01);
    const mockAi: WorkersAiBinding = {
      run: vi.fn().mockResolvedValue({
        data: [mockVector],
      }),
    };

    const model = createWorkersAIEmbeddingModel(mockAi);
    expect(model.modelId).toBe(DEFAULT_WORKERS_AI_EMBEDDING_MODEL);
    expect(model.provider).toBe("workers-ai");

    const result = await generateEmbedding(model, "テスト本文");
    expect(result).toHaveLength(1024);
    expect(result[0]).toBe(0.01);
    expect(mockAi.run).toHaveBeenCalledWith(
      DEFAULT_WORKERS_AI_EMBEDDING_MODEL,
      {
        text: ["テスト本文"],
      }
    );
  });

  it("response プロパティ形式のレスポンスも正常にパースできること", async () => {
    const mockVector1 = [0.1, 0.2, 0.3];
    const mockVector2 = [0.4, 0.5, 0.6];
    const mockAi: WorkersAiBinding = {
      run: vi.fn().mockResolvedValue({
        response: [mockVector1, mockVector2],
      }),
    };

    const model = createWorkersAIEmbeddingModel(
      mockAi,
      "@cf/baai/bge-small-en-v1.5"
    );
    const results = await generateEmbeddings(model, ["text1", "text2"]);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(mockVector1);
    expect(results[1]).toEqual(mockVector2);
  });

  it("空配列を渡した場合は空配列を返すこと", async () => {
    const mockAi: WorkersAiBinding = {
      run: vi.fn(),
    };

    const model = createWorkersAIEmbeddingModel(mockAi);
    const results = await generateEmbeddings(model, []);

    expect(results).toEqual([]);
    expect(mockAi.run).not.toHaveBeenCalled();
  });

  it("不正なレスポンス構造の場合はエラーをスローすること", async () => {
    const mockAi: WorkersAiBinding = {
      run: vi.fn().mockResolvedValue({
        somethingElse: "invalid",
      }),
    };

    const model = createWorkersAIEmbeddingModel(mockAi);
    await expect(generateEmbedding(model, "test")).rejects.toThrow(
      "Unexpected response structure from Workers AI embedding"
    );
  });

  it("createEmbeddingModel で workers-ai を指定するとエラーをスローすること", () => {
    expect(() =>
      createEmbeddingModel("workers-ai", "@cf/baai/bge-m3", {})
    ).toThrow(
      "Workers AI embedding provider requires the Cloudflare Workers AI binding"
    );
  });

  it("createWorkersAILanguageModel が正常に LanguageModel インスタンスを生成すること", () => {
    const mockAi: WorkersAiBinding = {
      run: vi.fn(),
    };
    const model = createWorkersAILanguageModel(mockAi);
    expect(model.modelId).toBe("@cf/google/gemma-4-26b-a4b-it");
    expect(model.provider).toBe("workersai.chat");
  });

  it("createLanguageModel で workers-ai を指定するとエラーをスローすること", () => {
    expect(() => createLanguageModel("workers-ai", "test-model", {})).toThrow(
      "Workers AI LLM provider is only supported via Cloudflare Workers AI binding"
    );
  });
});
