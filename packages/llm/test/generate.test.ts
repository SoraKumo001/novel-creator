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
        model: mockModel,
        providerOptions: { google: { outputDimensionality: 768 } },
        value: "テストテキスト",
      });
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
        model: mockModel,
        providerOptions: { google: { outputDimensionality: 768 } },
        values: ["テキスト1", "テキスト2"],
      });
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
