import type { EmbeddingModel, LanguageModel } from 'ai';
import type { Database } from '@novel-creator/db';
import type { Env } from '@novel-creator/shared';
import type { VectorStore } from '@novel-creator/vector';

export interface ServiceContext {
  db: Database;
  llm: LanguageModel;
  embedding: EmbeddingModel;
  vectorStore: VectorStore;
  env: Env;
}

export class NotFoundError extends Error {
  constructor(entityOrMessage: string = 'Resource not found', id?: string) {
    super(id ? `${entityOrMessage} ${id} not found` : entityOrMessage);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string = 'Validation error') {
    super(message);
    this.name = 'ValidationError';
  }
}
