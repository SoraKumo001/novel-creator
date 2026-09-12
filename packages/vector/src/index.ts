// Phase 1C: VectorStore 抽象化

export type { CreateVectorStoreOptions } from "./factory.js";
export { createVectorStore } from "./factory.js";
export type { NewVectorEmbedding, VectorEmbedding } from "./pg-vector-store.js";
export {
  createPgVectorStore,
  type HybridCapableStore,
  type HybridSearchHits,
  type HybridSearchOptions,
  supportsHybridSearch,
  vectorEmbeddings,
} from "./pg-vector-store.js";
export type { VectorRecord, VectorSearchResult, VectorStore } from "./types.js";
export {
  createVectorizeStore,
  type VectorizeBinding,
} from "./vectorize-store.js";
