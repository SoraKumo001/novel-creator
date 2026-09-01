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
