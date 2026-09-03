/** LLM 呼び出しの既定タイムアウト（ms）。 */
export const DEFAULT_LLM_TIMEOUT_MS = 120_000;

/** 埋め込み（embed / embedMany）呼び出しの既定タイムアウト（ms）。LLM 呼び出しと同じ既定値を再利用する。 */
export const DEFAULT_EMBEDDING_TIMEOUT_MS = DEFAULT_LLM_TIMEOUT_MS;

/** LLM 呼び出しの既定最大出力トークン数。 */
export const DEFAULT_LLM_MAX_OUTPUT_TOKENS = 8192;

/** 推論（reasoning）を有効化する対象の OpenAI モデル ID パターン（o1 / o3 / o4 / gpt-5 系）の既定値。 */
const DEFAULT_OPENAI_REASONING_MODEL_PATTERN = /^(o[134](-|$)|gpt-5)/;

/** Anthropic の thinking 予算トークン数の既定値。 */
const DEFAULT_ANTHROPIC_THINKING_BUDGET_TOKENS = 4000;

/**
 * 環境変数から正の整数を読み取る。
 * 未設定・不正値（非数値・0以下）の場合は fallback を返す。
 */
function readPositiveIntEnv(name: string, fallback: number): number {
  const raw =
    (typeof process !== "undefined" ? process.env?.[name] : undefined) ?? "";
  if (raw.trim() === "") {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * 環境変数から正規表現を読み取る。
 * 未設定・不正なパターンの場合は fallback を返す。
 */
function readRegexEnv(name: string, fallback: RegExp): RegExp {
  const raw =
    (typeof process !== "undefined" ? process.env?.[name] : undefined) ?? "";
  if (raw.trim() === "") {
    return fallback;
  }
  try {
    return new RegExp(raw.trim());
  } catch {
    return fallback;
  }
}

/** LLM タイムアウト（ms）。環境変数 `LLM_TIMEOUT_MS` で上書き可能。既定 120 秒。 */
export const LLM_TIMEOUT_MS = readPositiveIntEnv(
  "LLM_TIMEOUT_MS",
  DEFAULT_LLM_TIMEOUT_MS
);

/** 埋め込みタイムアウト（ms）。環境変数 `EMBEDDING_TIMEOUT_MS` で上書き可能。既定 120 秒。 */
export const EMBEDDING_TIMEOUT_MS = readPositiveIntEnv(
  "EMBEDDING_TIMEOUT_MS",
  DEFAULT_EMBEDDING_TIMEOUT_MS
);

/** LLM 最大出力トークン数。環境変数 `LLM_MAX_OUTPUT_TOKENS` で上書き可能。既定 8192。 */
export const LLM_MAX_OUTPUT_TOKENS = readPositiveIntEnv(
  "LLM_MAX_OUTPUT_TOKENS",
  DEFAULT_LLM_MAX_OUTPUT_TOKENS
);

/** 推論（reasoning）を有効化する対象の OpenAI モデル ID パターン。環境変数 `OPENAI_REASONING_MODEL_PATTERN` で上書き可能。 */
export const OPENAI_REASONING_MODEL_PATTERN = readRegexEnv(
  "OPENAI_REASONING_MODEL_PATTERN",
  DEFAULT_OPENAI_REASONING_MODEL_PATTERN
);

/** Anthropic の thinking 予算トークン数。環境変数 `ANTHROPIC_THINKING_BUDGET_TOKENS` で上書き可能。 */
export const ANTHROPIC_THINKING_BUDGET_TOKENS = readPositiveIntEnv(
  "ANTHROPIC_THINKING_BUDGET_TOKENS",
  DEFAULT_ANTHROPIC_THINKING_BUDGET_TOKENS
);
