import { APICallError } from 'ai';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';

import type { AppContext } from '../context.js';
import { NotFoundError, ValidationError } from '../core/types.js';

/**
 * エラーレスポンスの共通形式。
 * { error: { code, message, details? } }
 */
export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * エラータイプの分類結果。
 */
interface ClassifiedError {
  status: ContentfulStatusCode;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * LLM API エラー（APICallError）を分類する。
 * - 429: Rate Limit
 * - 500 系: サーバーエラー
 * - その他: プロバイダエラー
 */
function classifyLLMError(err: APICallError): ClassifiedError {
  const status = err.statusCode;
  if (status === 429) {
    return {
      status: 429,
      code: 'RATE_LIMITED',
      message: 'LLM API のレート制限に達しました。しばらく待ってから再試行してください。',
    };
  }
  if (status !== undefined && status >= 500 && status < 600) {
    return {
      status: 502,
      code: 'LLM_SERVER_ERROR',
      message: 'LLM API でサーバーエラーが発生しました。しばらく待ってから再試行してください。',
    };
  }
  return {
    status: 502,
    code: 'LLM_API_ERROR',
    message: err.message || 'LLM API の呼び出しに失敗しました。',
  };
}

/**
 * ネットワークエラー（fetch の TypeError など）を分類する。
 */
function classifyNetworkError(err: Error): ClassifiedError {
  return {
    status: 502,
    code: 'NETWORK_ERROR',
    message: 'ネットワークエラーが発生しました。接続を確認して再試行してください。',
    details: err.message,
  };
}

/**
 * zod バリデーションエラーを分類する。
 */
function classifyValidationError(err: ZodError): ClassifiedError {
  const issues = err.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
  return {
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'リクエストのバリデーションに失敗しました。',
    details: issues,
  };
}

/**
 * エラーを分類して適切な HTTP ステータスコードとメッセージを返す。
 */
function classifyError(err: unknown): ClassifiedError {
  if (err instanceof NotFoundError) {
    return {
      status: 404,
      code: 'NOT_FOUND',
      message: err.message,
    };
  }
  if (err instanceof ValidationError) {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: err.message,
    };
  }
  if (APICallError.isInstance(err)) {
    return classifyLLMError(err);
  }
  if (err instanceof ZodError) {
    return classifyValidationError(err);
  }
  if (err instanceof TypeError) {
    return classifyNetworkError(err);
  }
  if (err instanceof Error) {
    return {
      status: 500,
      code: 'INTERNAL_ERROR',
      message: err.message || 'Internal Server Error',
    };
  }
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Internal Server Error',
  };
}

/**
 * グローバルエラーハンドリング。
 * 未処理の例外をエラータイプに応じて分類し、JSON エラーレスポンスに変換する。
 */
export function errorHandler(err: Error, c: Context<AppContext>): Response {
  console.error('[error]', err);
  const classified = classifyError(err);
  const body: ErrorResponseBody = {
    error: {
      code: classified.code,
      message: classified.message,
      ...(classified.details !== undefined ? { details: classified.details } : {}),
    },
  };
  return c.json(body, classified.status);
}
