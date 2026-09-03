import type { Env } from "@novel-creator/shared";

import { createPgVectorStore } from "./pg-vector-store.js";
import type { VectorStore } from "./types.js";
import {
  createVectorizeStore,
  type VectorizeBinding,
} from "./vectorize-store.js";

export interface CreateVectorStoreOptions {
  vectorizeBinding?: VectorizeBinding;
}

export function createVectorStore(
  env: Env,
  options: CreateVectorStoreOptions = {}
): VectorStore {
  switch (env.VECTOR_STORE_PROVIDER) {
    case "pgvector":
      return createPgVectorStore(env.DATABASE_URL, env.EMBEDDING_DIMENSIONS);
    case "vectorize":
      if (!options.vectorizeBinding) {
        throw new Error(
          'VECTOR_STORE_PROVIDER が "vectorize" ですが、vectorizeBinding が指定されていません'
        );
      }
      return createVectorizeStore(options.vectorizeBinding);
    default:
      throw new Error(
        `未対応の VECTOR_STORE_PROVIDER: ${env.VECTOR_STORE_PROVIDER}`
      );
  }
}
