import type { LLMProviderType } from "@novel-creator/shared";
import type {
  EmbeddingModel,
  JSONValue,
  LanguageModel,
  OutputInterface,
  StopCondition,
  StreamTextResult,
  ToolSet,
} from "ai";
import {
  APICallError,
  generateText as aiGenerateText,
  streamText as aiStreamText,
  embed,
  embedMany,
} from "ai";
import type { ZodError, ZodType } from "zod";

/**
 * リトライ設定。
 * - maxRetries: 最大リトライ回数（デフォルト 3）
 * - retryDelay: 初回リトライまでの待機時間（ms、デフォルト 1000）
 *   以降は指数バックオフ（1s, 2s, 4s ...）で増加する。
 */
export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  retryDelay: 1000,
};

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
const LLM_TIMEOUT_MS = readPositiveIntEnv(
  "LLM_TIMEOUT_MS",
  DEFAULT_LLM_TIMEOUT_MS
);

/** 埋め込みタイムアウト（ms）。環境変数 `EMBEDDING_TIMEOUT_MS` で上書き可能。既定 120 秒。 */
const EMBEDDING_TIMEOUT_MS = readPositiveIntEnv(
  "EMBEDDING_TIMEOUT_MS",
  DEFAULT_EMBEDDING_TIMEOUT_MS
);

/** LLM 最大出力トークン数。環境変数 `LLM_MAX_OUTPUT_TOKENS` で上書き可能。既定 8192。 */
const LLM_MAX_OUTPUT_TOKENS = readPositiveIntEnv(
  "LLM_MAX_OUTPUT_TOKENS",
  DEFAULT_LLM_MAX_OUTPUT_TOKENS
);

/** 推論（reasoning）を有効化する対象の OpenAI モデル ID パターン。環境変数 `OPENAI_REASONING_MODEL_PATTERN` で上書き可能。 */
const OPENAI_REASONING_MODEL_PATTERN = readRegexEnv(
  "OPENAI_REASONING_MODEL_PATTERN",
  DEFAULT_OPENAI_REASONING_MODEL_PATTERN
);

/** Anthropic の thinking 予算トークン数。環境変数 `ANTHROPIC_THINKING_BUDGET_TOKENS` で上書き可能。 */
const ANTHROPIC_THINKING_BUDGET_TOKENS = readPositiveIntEnv(
  "ANTHROPIC_THINKING_BUDGET_TOKENS",
  DEFAULT_ANTHROPIC_THINKING_BUDGET_TOKENS
);

/**
 * AbortSignal.timeout などによる中断エラー（AbortError）かどうかを判定する。
 */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: unknown }).name === "AbortError"
  );
}

/**
 * リトライ対象のエラーかどうかを判定する。
 * - タイムアウト（AbortSignal.timeout）による中断: 再試行しない（terminal）
 * - ネットワークエラー（fetch の TypeError など）
 * - 429（Rate Limit）
 * - 500 系エラー
 * - AI SDK が isRetryable とマークしたエラー
 */
function isRetryableError(error: unknown): boolean {
  // タイムアウトによる中断は再試行すると無駄な待機が発生するため終端扱いにする。
  if (isAbortError(error)) {
    return false;
  }
  if (APICallError.isInstance(error)) {
    const status = error.statusCode;
    if (status === 429) {
      return true;
    }
    if (status !== undefined && status >= 500 && status < 600) {
      return true;
    }
    return error.isRetryable === true;
  }
  // fetch のネットワークエラーは TypeError として投げられる。
  if (error instanceof TypeError) {
    return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * リトライ付きで関数を実行する。指数バックオフで待機する。
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries, retryDelay } = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt > maxRetries || !isRetryableError(error)) {
        throw error;
      }
      const delay = retryDelay * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }
}

/**
 * generateText / streamText の呼び出しオプション。
 * RetryOptions に加え、呼び出し単位のタイムアウトと最大出力トークン数を指定できる。
 * 未指定時は環境変数（LLM_TIMEOUT_MS / LLM_MAX_OUTPUT_TOKENS）または既定値にフォールバックする。
 */
export interface GenerateTextOptions extends RetryOptions {
  /** 最大出力トークン数。未指定時は既定値（8192） */
  maxOutputTokens?: number;
  /** 呼び出し単位のタイムアウト（ms）。未指定時は既定値（120000） */
  timeoutMs?: number;
}

/**
 * AI SDK の generateText ラッパー。生成されたテキストを返す。
 * ネットワークエラー・429・500 系エラーはリトライする。
 * タイムアウト（AbortSignal.timeout）による中断はリトライせずそのまま伝播する。
 */
export async function generateText(
  model: LanguageModel,
  prompt: string,
  options: GenerateTextOptions = {}
): Promise<string> {
  const {
    maxOutputTokens = LLM_MAX_OUTPUT_TOKENS,
    timeoutMs = LLM_TIMEOUT_MS,
    ...retryOptions
  } = options;
  const abortSignal = AbortSignal.timeout(timeoutMs);
  return withRetry(async () => {
    const result = await aiGenerateText({
      model,
      prompt,
      abortSignal,
      maxOutputTokens,
    });
    return result.text;
  }, retryOptions);
}

/**
 * AI SDK の streamText ラッパー。テキストのチャンクを逐次 yield する。
 * ストリーム開始後はリトライできないため、接続時（ストリーム開始前）のみリトライする。
 * タイムアウト（AbortSignal.timeout）による中断はリトライせずそのまま伝播する。
 */
export async function* streamText(
  model: LanguageModel,
  prompt: string,
  options: GenerateTextOptions = {}
): AsyncGenerator<string> {
  const {
    maxOutputTokens = LLM_MAX_OUTPUT_TOKENS,
    timeoutMs = LLM_TIMEOUT_MS,
    ...retryOptions
  } = options;
  const abortSignal = AbortSignal.timeout(timeoutMs);
  const result = await withRetry(
    async () =>
      aiStreamText({
        model,
        prompt,
        abortSignal,
        maxOutputTokens,
      }),
    retryOptions
  );
  for await (const chunk of result.textStream) {
    yield chunk;
  }
}

/**
 * AI SDK の streamText ラッパー。生の StreamTextResult をそのまま返す。
 * ストリーム開始後はリトライできないため、接続時（ストリーム開始前）のみリトライする。
 * 呼び出し側で result.stream / result.toUIMessageStream() などを利用して
 * UI Message Stream への変換や onFinish での永続化を行う。
 */

/**
 * AI SDK 側では Arrayable<T> = T | T[] | undefined として定義されているが、
 * `ai` パッケージからは export されないためローカルで同型を定義する。
 */
type Arrayable<T> = T | T[] | undefined;

/**
 * プロバイダ固有オプション（AI SDK の ProviderOptions）。
 * `ai` パッケージは ProviderOptions（@ai-sdk/provider-utils 由来の
 * `Record<string, JSONObject>` 同型）を再エクスポートしないため、
 * 同型をローカルで定義している。
 */
export type ProviderOptions = Record<string, Record<string, JSONValue>>;

/**
 * streamText の各 LLM ステップの進捗情報。
 * - step: 1 始まりのステップ番号
 * - finishReason: phase が "step-finish" のときのみ設定される
 */
export interface StepProgress {
  finishReason?: string;
  phase: "step-start" | "step-finish";
  step: number;
}

export interface StreamTextOptions extends RetryOptions {
  /** 最大出力トークン数。未指定時は既定値（8192） */
  maxOutputTokens?: number;
  /** 各 LLM ステップの開始・終了時に呼ばれる進捗コールバック */
  onStep?: (progress: StepProgress) => void;
  /** プロバイダ固有オプション（例: reasoning / thinking の有効化） */
  providerOptions?: ProviderOptions;
  /** ツールループの停止条件。未指定時は AI SDK デフォルト（isStepCount(1)） */
  stopWhen?: Arrayable<StopCondition<ToolSet, Record<string, unknown>>>;
  /** 呼び出し単位のタイムアウト（ms）。未指定時は既定値（120000） */
  timeoutMs?: number;
  /** LLM に渡すツール群（AI SDK の tool() 形式） */
  tools?: ToolSet;
}

/**
 * 解決されたプロバイダ・モデル ID から、推論（reasoning / thinking）を
 * 有効化するためのプロバイダ固有オプションを構築する。
 * - openai: reasoning モデル（o1 / o3 / o4 / gpt-5 系）のみ reasoningEffort を設定
 * - anthropic: thinking を enabled（budgetTokens 付き）で設定
 * - google: thinkingConfig.includeThoughts を設定
 * - ollama / custom_openai: 対応しない（DeepSeek-R1 等は reasoning をネイティブに返す）
 *
 * 対象外のプロバイダ・モデルでは undefined を返す。
 */
export function buildReasoningProviderOptions(
  provider: LLMProviderType,
  modelId: string
): ProviderOptions | undefined {
  switch (provider) {
    case "openai":
      return OPENAI_REASONING_MODEL_PATTERN.test(modelId)
        ? { openai: { reasoningEffort: "medium" } }
        : undefined;
    case "anthropic":
      return {
        anthropic: {
          thinking: {
            budgetTokens: ANTHROPIC_THINKING_BUDGET_TOKENS,
            type: "enabled",
          },
        },
      };
    case "google":
      return { google: { thinkingConfig: { includeThoughts: true } } };
    case "ollama":
    case "custom_openai":
      return undefined;
    default:
      // LLMProviderType は上で全ケース網羅済み。default は実行時に provider が
      // 未解決（undefined 等）の場合のみ到達する。reasoning 未対応＝オプション無し
      // として undefined を返し、プロバイダ値自体の検証は provider.ts の構築処理が担う。
      return undefined;
  }
}

export async function streamTextResult<
  TOOLS extends ToolSet = Record<string, never>,
>(
  model: LanguageModel,
  prompt: string,
  options: StreamTextOptions = {} as StreamTextOptions
): Promise<StreamTextResult<TOOLS, Record<string, unknown>, OutputInterface>> {
  const {
    maxOutputTokens = LLM_MAX_OUTPUT_TOKENS,
    timeoutMs = LLM_TIMEOUT_MS,
    ...retryOptions
  } = options;
  const abortSignal = AbortSignal.timeout(timeoutMs);
  return withRetry(
    async () =>
      aiStreamText({
        model,
        prompt,
        abortSignal,
        maxOutputTokens,
        ...(options.tools ? { tools: options.tools as TOOLS } : {}),
        ...(options.stopWhen
          ? {
              stopWhen: options.stopWhen as NonNullable<
                StreamTextOptions["stopWhen"]
              >,
            }
          : {}),
        ...(options.providerOptions
          ? { providerOptions: options.providerOptions }
          : {}),
        ...(options.onStep
          ? {
              // AI SDK v7 では onStepStart / onStepEnd が各ステップの進捗フック
              // （onStepFinish は onStepEnd の非推奨エイリアス）。
              onStepStart: ({ stepNumber }) => {
                options.onStep?.({
                  phase: "step-start",
                  step: stepNumber + 1,
                });
              },
              onStepEnd: ({ finishReason, stepNumber }) => {
                options.onStep?.({
                  finishReason,
                  phase: "step-finish",
                  step: stepNumber + 1,
                });
              },
            }
          : {}),
      }),
    retryOptions
  );
}

/**
 * LLM 出力から ```json ... ``` または ``` ... ``` のコードブロックを除去する。
 * コードブロックが含まれない場合は入力文字列をそのまま返す。
 * コードブロックの内側はトリムして返す。
 */
function stripJSONCodeBlock(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return codeBlockMatch ? codeBlockMatch[1].trim() : text;
}

/**
 * LLM 出力から JSON 文字列を抽出する。
 * - ```json ... ``` コードブロックを除去（stripJSONCodeBlock に集約）
 * - 前後の空白・改行をトリム
 * - 先頭の { や [ から末尾の } や ] までを抽出
 */
function extractJSON(text: string): string {
  let cleaned = stripJSONCodeBlock(text.trim());

  // 先頭の { や [ から末尾の } や ] までを抽出
  const startIdx = cleaned.search(/[{[]/);
  if (startIdx === -1) {
    return cleaned;
  }
  const startChar = cleaned[startIdx];
  const endChar = startChar === "{" ? "}" : "]";
  const endIdx = cleaned.lastIndexOf(endChar);
  if (endIdx === -1 || endIdx < startIdx) {
    return cleaned;
  }

  return cleaned.slice(startIdx, endIdx + 1);
}

/**
 * generateJSON の呼び出しオプション。
 * RetryOptions に加え、呼び出し単位のタイムアウトと最大出力トークン数を指定できる。
 */
export interface GenerateJSONOptions extends RetryOptions {
  /** 最大出力トークン数。未指定時は既定値（8192） */
  maxOutputTokens?: number;
  /** 呼び出し単位のタイムアウト（ms）。未指定時は既定値（120000） */
  timeoutMs?: number;
}

/**
 * zod スキーマのバリデーションに失敗したことを表すエラー。
 * 元の ZodError は zodError プロパティに保持する。
 */
export class JSONValidationError extends Error {
  readonly zodError: ZodError;

  constructor(message: string, zodError: ZodError) {
    super(message);
    this.name = "JSONValidationError";
    this.zodError = zodError;
  }
}

/** ZodError を修復プロンプトに埋め込める1行サマリーへ変換する。 */
function summarizeZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

/**
 * AI SDK の generateText を利用して JSON を生成し、パースして返す。
 * モデルが JSON を返すようプロンプト側で指示する前提。
 * コードブロック（```json ... ```）で囲まれている場合も自動的に除去する。
 *
 * schema が渡された場合はパース結果を zod で検証し、失敗時は zod エラーサマリーを
 * 付与した修復プロンプトで1回だけ再生成する。再生成後も失敗した場合は
 * JSONValidationError を投げる。
 */
export async function generateJSON<T>(
  model: LanguageModel,
  prompt: string,
  schema?: ZodType<T>,
  options: GenerateJSONOptions = {}
): Promise<T> {
  const generateOnce = async (currentPrompt: string): Promise<T> => {
    const text = await generateText(model, currentPrompt, options);
    const jsonStr = extractJSON(text);
    const value = JSON.parse(jsonStr) as unknown;

    if (schema) {
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        throw new JSONValidationError(
          summarizeZodError(parsed.error),
          parsed.error
        );
      }
      return parsed.data;
    }
    return value as T;
  };

  try {
    return await generateOnce(prompt);
  } catch (error) {
    if (!(error instanceof JSONValidationError)) {
      throw error;
    }
    // zod バリデーション失敗時は1回だけ、エラー内容を付与した修復プロンプトで再生成する。
    const repairPrompt =
      `${prompt}\n\n` +
      "前回の出力は以下のバリデーションエラーがありました。" +
      "エラーを解消するよう、JSON のみを修正して再出力してください。\n" +
      `エラー: ${error.message}`;
    return generateOnce(repairPrompt);
  }
}

/**
 * プロバイダ別の埋め込みオプションを構築する。
 * - Google: { google: { outputDimensionality: dimensions } }
 * - OpenAI / Custom OpenAI: { openai: { dimensions } }
 */
export function buildEmbeddingProviderOptions(
  providerOrModel?: LLMProviderType | string | EmbeddingModel | null,
  dimensions?: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> | undefined {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providerOptions?: Record<string, any>;
  /** 呼び出し単位のタイムアウト（ms）。未指定時は既定値（120000） */
  timeoutMs?: number;
}

/**
 * AI SDK の embed 関数ラッパー。テキストの埋め込みベクトルを返す。
 * ネットワークエラー・429・500 系エラーはリトライする。
 * タイムアウト（AbortSignal.timeout）による中断はリトライせずそのまま伝播する。
 *
 * dimensions を指定すると各プロバイダに応じた次元数オプションが自動設定される。
 * providerOptions でプロバイダ固有のオプションを直接渡すことも可能。
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
      model,
      value: text,
      abortSignal,
      ...(mergedProviderOptions
        ? { providerOptions: mergedProviderOptions }
        : {}),
    });
    return result.embedding;
  }, retryOptions);
}

/**
 * AI SDK の embedMany 関数ラッパー。複数テキストの埋め込みベクトル配列を一括で返す。
 * ネットワークエラー・429・500 系エラーはリトライする。
 * タイムアウト（AbortSignal.timeout）による中断はリトライせずそのまま伝播する。
 *
 * dimensions を指定すると各プロバイダに応じた次元数オプションが自動設定される。
 * providerOptions でプロバイダ固有のオプションを直接渡すことも可能。
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
      model,
      values: texts,
      abortSignal,
      ...(mergedProviderOptions
        ? { providerOptions: mergedProviderOptions }
        : {}),
    });
    return result.embeddings;
  }, retryOptions);
}
