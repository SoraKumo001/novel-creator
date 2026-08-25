import {
  APICallError,
  embed,
  generateText as aiGenerateText,
  streamText as aiStreamText,
} from 'ai';
import type { EmbeddingModel, LanguageModel } from 'ai';

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
    if (status === 429) return true;
    if (status !== undefined && status >= 500 && status < 600) return true;
    return error.isRetryable === true;
  }
  // fetch のネットワークエラーは TypeError として投げられる。
  if (error instanceof TypeError) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * リトライ付きで関数を実行する。指数バックオフで待機する。
 */
async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
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
  options: RetryOptions = {},
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
  options: RetryOptions = {},
): AsyncGenerator<string> {
  const result = await withRetry(async () => aiStreamText({ model, prompt }), options);
  for await (const chunk of result.textStream) {
    yield chunk;
  }
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
  if (startIdx === -1) return cleaned;
  const startChar = cleaned[startIdx];
  const endChar = startChar === '{' ? '}' : ']';
  const endIdx = cleaned.lastIndexOf(endChar);
  if (endIdx === -1 || endIdx < startIdx) return cleaned;

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
  options: RetryOptions = {},
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
  } = {},
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
