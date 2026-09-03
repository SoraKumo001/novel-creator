import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateEmbedding,
  generateEmbeddings,
  generateJSON,
} from "../src/generate.js";

const mockEmbed = vi.fn();
const mockEmbedMany = vi.fn();
const mockGenerateText = vi.fn();

vi.mock("ai", () => ({
  APICallError: class APICallError extends Error {
    static isInstance(err: unknown): boolean {
      return err instanceof APICallError;
    }
    statusCode?: number;
    isRetryable?: boolean;
    constructor(message: string, statusCode?: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  embed: (...args: unknown[]) => mockEmbed(...args),
  embedMany: (...args: unknown[]) => mockEmbedMany(...args),
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

describe("generate.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateEmbedding", () => {
    it("単一テキストの埋め込みベクトルを生成できること", async () => {
      mockEmbed.mockResolvedValueOnce({ embedding: [0.1, 0.2, 0.3] });
      const mockModel = { modelId: "test-model" } as never;

      const result = await generateEmbedding(mockModel, "テストテキスト", {
        providerOptions: { google: { outputDimensionality: 768 } },
      });

      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(mockEmbed).toHaveBeenCalledWith({
        abortSignal: expect.any(AbortSignal),
        model: mockModel,
        providerOptions: { google: { outputDimensionality: 768 } },
        value: "テストテキスト",
      });
    });

    it("embed が応答しない場合、指定タイムアウトで AbortError を送出すること", async () => {
      mockEmbed.mockImplementation(
        ({ abortSignal }: { abortSignal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            abortSignal.addEventListener("abort", () => {
              reject(
                new DOMException("The operation was aborted", "AbortError")
              );
            });
          })
      );
      const mockModel = { modelId: "test-model" } as never;

      const startedAt = Date.now();
      await expect(
        generateEmbedding(mockModel, "テストテキスト", { timeoutMs: 100 })
      ).rejects.toMatchObject({ name: "AbortError" });
      // 既定の 120 秒を待たず、指定タイムアウト（100ms）前後に即座に拒否されること
      expect(Date.now() - startedAt).toBeLessThan(5000);
    });
  });

  describe("generateEmbeddings", () => {
    it("空配列の場合は即座に空配列を返すこと", async () => {
      const mockModel = { modelId: "test-model" } as never;
      const result = await generateEmbeddings(mockModel, []);
      expect(result).toEqual([]);
      expect(mockEmbedMany).not.toHaveBeenCalled();
    });

    it("複数テキストの埋め込みベクトル配列を一括生成できること", async () => {
      mockEmbedMany.mockResolvedValueOnce({
        embeddings: [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
      });
      const mockModel = { modelId: "test-model" } as never;

      const result = await generateEmbeddings(
        mockModel,
        ["テキスト1", "テキスト2"],
        {
          providerOptions: { google: { outputDimensionality: 768 } },
        }
      );

      expect(result).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
      expect(mockEmbedMany).toHaveBeenCalledWith({
        abortSignal: expect.any(AbortSignal),
        model: mockModel,
        providerOptions: { google: { outputDimensionality: 768 } },
        values: ["テキスト1", "テキスト2"],
      });
    });

    it("embedMany が応答しない場合、指定タイムアウトで AbortError を送出すること", async () => {
      mockEmbedMany.mockImplementation(
        ({ abortSignal }: { abortSignal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            abortSignal.addEventListener("abort", () => {
              reject(
                new DOMException("The operation was aborted", "AbortError")
              );
            });
          })
      );
      const mockModel = { modelId: "test-model" } as never;

      const startedAt = Date.now();
      await expect(
        generateEmbeddings(mockModel, ["テキスト"], { timeoutMs: 100 })
      ).rejects.toMatchObject({ name: "AbortError" });
      // 既定の 120 秒を待たず、指定タイムアウト（100ms）前後に即座に拒否されること
      expect(Date.now() - startedAt).toBeLessThan(5000);
    });
  });

  describe("generateJSON", () => {
    it("マークダウンコードブロック付きJSONをパースできること", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: '```json\n{"key": "value"}\n```',
      });
      const mockModel = { modelId: "test-model" } as never;

      const result = await generateJSON<{ key: string }>(mockModel, "prompt");
      expect(result).toEqual({ key: "value" });
    });
  });
});
