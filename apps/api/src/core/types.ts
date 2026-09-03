import type { Database } from "@novel-creator/db";
import type { Env } from "@novel-creator/shared";
import type { VectorStore } from "@novel-creator/vector";
import type { EmbeddingModel, LanguageModel } from "ai";

export interface ServiceContext {
  db: Database;
  embedding: EmbeddingModel;
  env: Env;
  llm: LanguageModel;
  vectorStore: VectorStore;
}

export class NotFoundError extends Error {
  constructor(entityOrMessage = "Resource not found", id?: string) {
    super(id ? `${entityOrMessage} ${id} not found` : entityOrMessage);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message = "Validation error") {
    super(message);
    this.name = "ValidationError";
  }
}

export type ErrorCode =
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "HISTORY_ERROR"
  | "VECTOR_ERROR";

/**
 * Phase 1 のエラー契約: 分類可能なアプリエラー基底クラス。
 * code/status/details を保持し error-handler の classifyError で共通変換する。
 * 既存レスポンス形状 { error: { code, message, details? } } は維持する。
 */
export class AppError extends Error {
  readonly code: ErrorCode | string;
  readonly details?: unknown;
  readonly status: number;

  constructor(
    message: string,
    options: {
      code?: ErrorCode | string;
      details?: unknown;
      status?: number;
    } = {}
  ) {
    super(message);
    this.name = "AppError";
    this.code = options.code ?? "INTERNAL_ERROR";
    this.details = options.details;
    this.status = options.status ?? 500;
  }
}

export type Result<T, E extends Error = Error> =
  | { error: E; ok: false }
  | { ok: true; value: T };

/**
 * 行が取得できなかった場合に NotFoundError を投げる。
 * NotFoundError と同じ引数形式でエラーメッセージを構築する。
 */
export function assertFound<T>(
  row: T | undefined,
  entityOrMessage: string,
  id?: string
): asserts row is T {
  if (!row) {
    throw new NotFoundError(entityOrMessage, id);
  }
}
