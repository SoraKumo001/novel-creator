// Phase 1C: VectorStore 抽象化
export type { VectorRecord, VectorSearchResult, VectorStore } from './types.js';
export { createPgVectorStore, vectorEmbeddings } from './pg-vector-store.js';
export type { VectorEmbedding, NewVectorEmbedding } from './pg-vector-store.js';
export { createVectorizeStore } from './vectorize-store.js';
export { createVectorStore } from './factory.js';
export type { CreateVectorStoreOptions } from './factory.js';
