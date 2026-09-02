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

/**
 * リトライ対象のエラーかどうかを判定する。
 * - ネットワークエラー（fetch の TypeError など）
 * - 429（Rate Limit）
 * - 500 系エラー
 * - AI SDK が isRetryable とマークしたエラー
 */
function isRetryableError(error: unknown): boolean {
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
 * AI SDK の generateText ラッパー。生成されたテキストを返す。
 * ネットワークエラー・429・500 系エラーはリトライする。
 */
export async function generateText(
  model: LanguageModel,
  prompt: string,
  options: RetryOptions = {}
): Promise<string> {
  return withRetry(async () => {
    const result = await aiGenerateText({ model, prompt });
    return result.text;
  }, options);
}

/**
 * AI SDK の streamText ラッパー。テキストのチャンクを逐次 yield する。
 * ストリーム開始後はリトライできないため、接続時（ストリーム開始前）のみリトライする。
 */
export async function* streamText(
  model: LanguageModel,
  prompt: string,
  options: RetryOptions = {}
): AsyncGenerator<string> {
  const result = await withRetry(
    async () => aiStreamText({ model, prompt }),
    options
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
  /** 各 LLM ステップの開始・終了時に呼ばれる進捗コールバック */
  onStep?: (progress: StepProgress) => void;
  /** プロバイダ固有オプション（例: reasoning / thinking の有効化） */
  providerOptions?: ProviderOptions;
  /** ツールループの停止条件。未指定時は AI SDK デフォルト（isStepCount(1)） */
  stopWhen?: Arrayable<StopCondition<ToolSet, Record<string, unknown>>>;
  /** LLM に渡すツール群（AI SDK の tool() 形式） */
  tools?: ToolSet;
}

/** 推論（reasoning）を有効化する対象の OpenAI モデル ID パターン（o1 / o3 / o4 / gpt-5 系） */
const OPENAI_REASONING_MODEL_PATTERN = /^(o[134](-|$)|gpt-5)/;

/** Anthropic の thinking 予算トークン数 */
const ANTHROPIC_THINKING_BUDGET_TOKENS = 4000;

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
  return withRetry(
    async () =>
      aiStreamText({
        model,
        prompt,
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
    options
  );
}

/**
 * LLM 出力から JSON 文字列を抽出する。
 * - ```json ... ``` コードブロックを除去
 * - 前後の空白・改行をトリム
 * - 先頭の { や [ から末尾の } や ] までを抽出
 */
function extractJSON(text: string): string {
  let cleaned = text.trim();

  // ```json ... ``` または ``` ... ``` コードブロックを除去
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

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
 * AI SDK の generateText を利用して JSON を生成し、パースして返す。
 * モデルが JSON を返すようプロンプト側で指示する前提。
 * コードブロック（```json ... ```）で囲まれている場合も自動的に除去する。
 */
export async function generateJSON<T>(
  model: LanguageModel,
  prompt: string,
  options: RetryOptions = {}
): Promise<T> {
  const text = await generateText(model, prompt, options);
  const jsonStr = extractJSON(text);
  return JSON.parse(jsonStr) as T;
}

/**
 * AI SDK の embed 関数ラッパー。テキストの埋め込みベクトルを返す。
 * ネットワークエラー・429・500 系エラーはリトライする。
 *
 * providerOptions でプロバイダ固有のオプションを渡せる。
 * 例: Google の outputDimensionality, taskType
 *   { providerOptions: { google: { outputDimensionality: 768 } } }
 */
export async function generateEmbedding(
  model: EmbeddingModel,
  text: string,
  options: RetryOptions & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providerOptions?: Record<string, any>;
  } = {}
): Promise<number[]> {
  const { providerOptions, ...retryOptions } = options;
  return withRetry(async () => {
    const result = await embed({
      model,
      value: text,
      ...(providerOptions ? { providerOptions } : {}),
    });
    return result.embedding;
  }, retryOptions);
}

/**
 * AI SDK の embedMany 関数ラッパー。複数テキストの埋め込みベクトル配列を一括で返す。
 * ネットワークエラー・429・500 系エラーはリトライする。
 */
export async function generateEmbeddings(
  model: EmbeddingModel,
  texts: string[],
  options: RetryOptions & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providerOptions?: Record<string, any>;
  } = {}
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }
  const { providerOptions, ...retryOptions } = options;
  return withRetry(async () => {
    const result = await embedMany({
      model,
      values: texts,
      ...(providerOptions ? { providerOptions } : {}),
    });
    return result.embeddings;
  }, retryOptions);
}
