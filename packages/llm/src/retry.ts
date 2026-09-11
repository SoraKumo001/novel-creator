import { APICallError } from "ai";

/**
 * リトライ設定。
 * - maxRetries: 最大リトライ回数（デフォルト 3）
 * - retryDelay: 初回リトライまでの待機時間（ms、デフォルト 1000）
 *   以降は指数バックオフ（1s, 2s, 4s ...）で増加する。
 * - onRetry: リトライ待機時に呼び出されるコールバック
 */
export interface RetryAttemptInfo {
  attempt: number;
  delayMs: number;
  error: unknown;
  isRateLimit: boolean;
  maxRetries: number;
}

export interface RetryOptions {
  maxRetries?: number;
  onRetry?: (info: RetryAttemptInfo) => void;
  retryDelay?: number;
}

export const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, "onRetry">> = {
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * AbortSignal.timeout などによる中断エラー（AbortError）かどうかを判定する。
 */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: unknown }).name === "AbortError"
  );
}

/**
 * エラーオブジェクトから API が指定する推奨待機時間（ミリ秒）を抽出する。
 * - responseHeaders の retry-after（秒数）
 * - Google Gemini などの details 内の RetryInfo.retryDelay（例: "16s", "16.46s"）
 * - message や responseBody 内の "Please retry in X.Xs"
 */
export function extractRetryDelayMs(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  // 1. responseHeaders の retry-after を確認
  if (
    "responseHeaders" in error &&
    error.responseHeaders &&
    typeof error.responseHeaders === "object"
  ) {
    const headers = error.responseHeaders as Record<string, string | undefined>;
    const retryAfter = headers["retry-after"] ?? headers["Retry-After"];
    if (retryAfter) {
      const seconds = Number.parseFloat(retryAfter);
      if (!Number.isNaN(seconds) && seconds > 0) {
        return Math.round(seconds * 1000);
      }
    }
  }

  // 2. responseBody や message のテキストから探索
  const textCandidates: string[] = [];
  if ("responseBody" in error && typeof error.responseBody === "string") {
    textCandidates.push(error.responseBody);
  }
  if ("message" in error && typeof error.message === "string") {
    textCandidates.push(error.message);
  }

  for (const text of textCandidates) {
    // "retryDelay": "16s" または "retryDelay": "16.5s"
    const retryDelayMatch = text.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/i);
    if (retryDelayMatch?.[1]) {
      const sec = Number.parseFloat(retryDelayMatch[1]);
      if (!Number.isNaN(sec) && sec > 0) {
        return Math.round(sec * 1000);
      }
    }

    // "Please retry in 16.462914827s" または "retry in 16s"
    const retryInMatch = text.match(/retry in\s+(\d+(?:\.\d+)?)\s*s/i);
    if (retryInMatch?.[1]) {
      const sec = Number.parseFloat(retryInMatch[1]);
      if (!Number.isNaN(sec) && sec > 0) {
        return Math.round(sec * 1000);
      }
    }
  }

  return null;
}

/**
 * リトライ対象のエラーかどうかを判定する。
 * - タイムアウト（AbortSignal.timeout）による中断: 再試行しない（terminal）
 * - ネットワークエラー（fetch の TypeError など）
 * - 429（Rate Limit）
 * - 500 系エラー
 * - AI SDK が isRetryable とマークしたエラー
 */
export function isRetryableError(error: unknown): boolean {
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
  if (error instanceof TypeError) {
    return true;
  }
  return false;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * リトライ付きで関数を実行する。指数バックオフ（または API 指定の待機時間）で待機する。
 */
export async function withRetry<T>(
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

      const isRateLimit =
        (APICallError.isInstance(error) && error.statusCode === 429) ||
        (typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof (error as { message: unknown }).message === "string" &&
          /rate[- ]?limit|quota|resource_exhausted/i.test(
            (error as { message: string }).message
          ));

      const serverDelay = extractRetryDelayMs(error);
      // サーバーから待機時間指定があればそれを優先採用（安全マージンとして +500ms）
      const delay =
        serverDelay !== null
          ? serverDelay + 500
          : retryDelay * 2 ** (attempt - 1);

      options.onRetry?.({
        attempt,
        delayMs: delay,
        error,
        isRateLimit,
        maxRetries,
      });

      await sleep(delay);
    }
  }
}
