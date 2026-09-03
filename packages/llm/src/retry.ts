import { APICallError } from "ai";

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

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
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
 * リトライ付きで関数を実行する。指数バックオフで待機する。
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
      const delay = retryDelay * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }
}
