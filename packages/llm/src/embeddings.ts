import type { LLMProviderType } from "@novel-creator/shared";
import type { EmbeddingModel } from "ai";
import { embed, embedMany } from "ai";
import { EMBEDDING_TIMEOUT_MS } from "./llm-config.js";
import type { RetryOptions } from "./retry.js";
import { withRetry } from "./retry.js";
import type { ProviderOptions } from "./stream-options.js";

/**
 * プロバイダ別の埋め込みオプションを構築する。
 * - Google: { google: { outputDimensionality: dimensions } }
 * - OpenAI / Custom OpenAI: { openai: { dimensions } }
 */
export function buildEmbeddingProviderOptions(
  providerOrModel?: LLMProviderType | string | EmbeddingModel | null,
  dimensions?: number | null
): ProviderOptions | undefined {
  if (!dimensions || dimensions <= 0) {
    return undefined;
  }
  let providerStr = "";
  if (typeof providerOrModel === "string") {
    providerStr = providerOrModel;
  } else if (typeof providerOrModel === "object" && providerOrModel !== null) {
    const rawProvider = (providerOrModel as { provider?: unknown }).provider;
    if (typeof rawProvider === "string") {
      providerStr = rawProvider;
    } else {
      const rawModelId = (providerOrModel as { modelId?: unknown }).modelId;
      if (typeof rawModelId === "string") {
        providerStr = rawModelId;
      }
    }
  }

  const p = providerStr.toLowerCase();
  if (p === "google" || p.includes("google")) {
    return { google: { outputDimensionality: dimensions } };
  }
  if (p === "openai" || p.includes("openai") || p === "custom_openai") {
    return { openai: { dimensions } };
  }
  return undefined;
}

export interface GenerateEmbeddingOptions extends RetryOptions {
  /** 埋め込み次元数。指定された場合、プロバイダに応じた providerOptions を自動生成する */
  dimensions?: number;
  providerOptions?: ProviderOptions;
  /** 呼び出し単位のタイムアウト（ms）。未指定時は既定値（120000） */
  timeoutMs?: number;
}

/**
 * AI SDK の embed 関数ラッパー。テキストの埋め込みベクトルを返す。
 */
export async function generateEmbedding(
  model: EmbeddingModel,
  text: string,
  options: GenerateEmbeddingOptions = {}
): Promise<number[]> {
  const {
    dimensions,
    providerOptions,
    timeoutMs = EMBEDDING_TIMEOUT_MS,
    ...retryOptions
  } = options;
  const autoOptions = dimensions
    ? buildEmbeddingProviderOptions(model, dimensions)
    : undefined;
  const mergedProviderOptions =
    autoOptions || providerOptions
      ? { ...autoOptions, ...providerOptions }
      : undefined;

  const abortSignal = AbortSignal.timeout(timeoutMs);
  return withRetry(async () => {
    const result = await embed({
      abortSignal,
      model,
      value: text,
      ...(mergedProviderOptions
        ? { providerOptions: mergedProviderOptions }
        : {}),
    });
    return result.embedding;
  }, retryOptions);
}

/**
 * AI SDK の embedMany 関数ラッパー。複数テキストの埋め込みベクトル配列を一括で返す。
 */
export async function generateEmbeddings(
  model: EmbeddingModel,
  texts: string[],
  options: GenerateEmbeddingOptions = {}
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }
  const {
    dimensions,
    providerOptions,
    timeoutMs = EMBEDDING_TIMEOUT_MS,
    ...retryOptions
  } = options;
  const autoOptions = dimensions
    ? buildEmbeddingProviderOptions(model, dimensions)
    : undefined;
  const mergedProviderOptions =
    autoOptions || providerOptions
      ? { ...autoOptions, ...providerOptions }
      : undefined;

  const abortSignal = AbortSignal.timeout(timeoutMs);
  return withRetry(async () => {
    const result = await embedMany({
      abortSignal,
      model,
      values: texts,
      ...(mergedProviderOptions
        ? { providerOptions: mergedProviderOptions }
        : {}),
    });
    return result.embeddings;
  }, retryOptions);
}
