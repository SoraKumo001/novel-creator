import type { EmbeddingModel } from "ai";

/**
 * Cloudflare Workers AI バインディングの最小限のインターフェース。
 */
export interface WorkersAiBinding {
  run(
    model: string,
    inputs: Record<string, unknown>,
    options?: Record<string, unknown>
  ): Promise<unknown>;
}

export const DEFAULT_WORKERS_AI_EMBEDDING_MODEL = "@cf/baai/bge-m3";

interface WorkersAiEmbeddingResponse {
  data?: unknown;
  response?: unknown;
  result?: {
    data?: unknown;
    response?: unknown;
  };
}

/**
 * Cloudflare Workers AI の Embedding モデル（@cf/baai/bge-m3 等）を
 * AI SDK の EmbeddingModel インターフェースに適合させるアダプタを生成する。
 */
export function createWorkersAIEmbeddingModel(
  ai: WorkersAiBinding,
  model = DEFAULT_WORKERS_AI_EMBEDDING_MODEL
): EmbeddingModel {
  const modelInstance = {
    specificationVersion: "v4" as const,
    modelId: model,
    provider: "workers-ai",
    maxEmbeddingsPerCall: 32,
    supportsParallelCalls: true,
    async doEmbed({ values }: { values: string[] }) {
      if (values.length === 0) {
        return {
          embeddings: [],
        };
      }

      const raw = (await ai.run(model, {
        text: values,
      })) as WorkersAiEmbeddingResponse | null | undefined;

      const rawData =
        raw?.data ??
        raw?.response ??
        raw?.result?.data ??
        raw?.result?.response;

      if (!Array.isArray(rawData)) {
        throw new Error(
          `Unexpected response structure from Workers AI embedding (${model}): ${JSON.stringify(raw)}`
        );
      }

      // 各要素が number[] であることを検証
      const embeddings: number[][] = [];
      for (let i = 0; i < rawData.length; i++) {
        const item = rawData[i];
        if (!Array.isArray(item)) {
          throw new Error(
            `Workers AI embedding at index ${i} is not an array: ${typeof item}`
          );
        }
        embeddings.push(item as number[]);
      }

      return {
        embeddings,
      };
    },
  };

  return modelInstance as unknown as EmbeddingModel;
}
