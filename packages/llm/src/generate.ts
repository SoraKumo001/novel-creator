// Phase 2c-1: generate.ts は後方互換の再export層。実装は各モジュールに分割。
// - retry.ts: リトライ判定・指数バックオフ
// - llm-config.ts: 既定値・環境変数解決
// - text-generation.ts: generateText / streamText
// - stream-options.ts: ProviderOptions / 推論オプション / streamTextResult
// - json-generation.ts: generateJSON / JSONValidationError
// - embeddings.ts: generateEmbedding(s) / プロバイダオプション
// 振る舞い変更なし。既存importパス `./generate.js` は維持される。

export {
  buildEmbeddingProviderOptions,
  type GenerateEmbeddingOptions,
  generateEmbedding,
  generateEmbeddings,
} from "./embeddings.js";
export {
  type GenerateJSONOptions,
  generateJSON,
  JSONValidationError,
} from "./json-generation.js";
export {
  DEFAULT_EMBEDDING_TIMEOUT_MS,
  DEFAULT_LLM_MAX_OUTPUT_TOKENS,
  DEFAULT_LLM_TIMEOUT_MS,
} from "./llm-config.js";
export {
  type RetryOptions,
  withRetry,
} from "./retry.js";
export {
  buildReasoningProviderOptions,
  type ProviderOptions,
  type StepProgress,
  type StreamTextOptions,
  streamTextResult,
} from "./stream-options.js";
export {
  type GenerateTextOptions,
  generateText,
  streamText,
} from "./text-generation.js";
