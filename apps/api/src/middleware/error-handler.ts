import { APICallError } from "ai";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";

import type { AppContext } from "../context.js";
import { NotFoundError, ValidationError } from "../core/types.js";

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
  code: string;
  details?: unknown;
  message: string;
  status: ContentfulStatusCode;
}

/**
 * LLM API エラー（APICallError）を分類する。
 * - 429: Rate Limit
 * - 500 系: サーバーエラー
 * - その他: プロバイダエラー
 */
function classifyLLMError(err: APICallError): ClassifiedError {
  const status = err.statusCode;
  if (status === 401 || status === 403) {
    return {
      code: "LLM_AUTH_ERROR",
      details: err.message,
      message:
        "LLM API の認証に失敗しました。APIキーまたは権限設定を確認してください。",
      status: 502,
    };
  }
  if (status === 429) {
    return {
      code: "RATE_LIMITED",
      details: err.message,
      message:
        "LLM API のレート制限に達しました。しばらく待ってから再試行してください。",
      status: 429,
    };
  }
  if (status === 400) {
    return {
      code: "LLM_BAD_REQUEST",
      details: err.message,
      message:
        "LLM API へのリクエストが不正です（コンテキスト長の上限超過などの可能性があります）。",
      status: 400,
    };
  }
  if (status !== undefined && status >= 500 && status < 600) {
    return {
      code: "LLM_SERVER_ERROR",
      details: err.message,
      message:
        "LLM API でサーバーエラーが発生しました。しばらく待ってから再試行してください。",
      status: 502,
    };
  }
  return {
    code: "LLM_API_ERROR",
    details: err.responseBody,
    message: err.message || "LLM API の呼び出しに失敗しました。",
    status: 502,
  };
}

/**
 * ネットワークエラー（fetch の TypeError など）を分類する。
 */
function classifyNetworkError(err: Error): ClassifiedError {
  return {
    code: "NETWORK_ERROR",
    details: err.message,
    message:
      "ネットワークエラーが発生しました。接続を確認して再試行してください。",
    status: 502,
  };
}

/**
 * zod バリデーションエラーを分類する。
 */
function classifyValidationError(err: ZodError): ClassifiedError {
  const issues = err.issues.map((issue) => ({
    message: issue.message,
    path: issue.path.join("."),
  }));
  return {
    code: "VALIDATION_ERROR",
    details: issues,
    message: "リクエストのバリデーションに失敗しました。",
    status: 400,
  };
}

/**
 * エラーを分類して適切な HTTP ステータスコードとメッセージを返す。
 */
export function classifyError(err: unknown): ClassifiedError {
  if (err instanceof NotFoundError) {
    return {
      code: "NOT_FOUND",
      message: err.message,
      status: 404,
    };
  }
  if (err instanceof ValidationError) {
    return {
      code: "VALIDATION_ERROR",
      message: err.message,
      status: 400,
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
      code: "INTERNAL_ERROR",
      message: err.message || "Internal Server Error",
      status: 500,
    };
  }
  return {
    code: "INTERNAL_ERROR",
    message: typeof err === "string" ? err : "Internal Server Error",
    status: 500,
  };
}

/**
 * エラーオブジェクトからユーザー向けの詳細エラーメッセージ文字列を整形する。
 * ストリーミング中の onError コールバックなどで使用する。
 */
export function formatErrorMessage(err: unknown): string {
  const classified = classifyError(err);
  if (classified.details && typeof classified.details === "string") {
    return `${classified.message}\n詳細: ${classified.details}`;
  }
  if (
    APICallError.isInstance(err) &&
    err.message &&
    err.message !== classified.message
  ) {
    return `${classified.message}\n詳細: ${err.message}`;
  }
  return classified.message;
}

/**
 * グローバルエラーハンドリング。
 * 未処理の例外をエラータイプに応じて分類し、JSON エラーレスポンスに変換する。
 */
export function errorHandler(err: Error, c: Context<AppContext>): Response {
  console.error("[error]", err);
  const classified = classifyError(err);
  const body: ErrorResponseBody = {
    error: {
      code: classified.code,
      message: classified.message,
      ...(classified.details === undefined
        ? {}
        : { details: classified.details }),
    },
  };
  return c.json(body, classified.status);
}
