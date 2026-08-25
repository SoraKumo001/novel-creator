import { randomUUID } from 'node:crypto';

import type { EmbeddingModel } from 'ai';

import { generateEmbedding } from '@novel-creator/llm';
import type { Env } from '@novel-creator/shared';
import type { VectorStore } from '@novel-creator/vector';

export interface SearchContextOptions {
  query: string;
  topK?: number;
  previousContent?: string;
}

export interface SearchContextResult {
  characters: string[];
  settings: string[];
  previousContent?: string;
}

/**
 * プロバイダ別の embedding オプションを構築する。
 * Google の場合は outputDimensionality を指定して次元数を制御する。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildEmbeddingProviderOptions(env: Env): Record<string, any> | undefined {
  const provider = env.EMBEDDING_PROVIDER ?? env.LLM_PROVIDER;
  if (provider === 'google') {
    return { google: { outputDimensionality: env.EMBEDDING_DIMENSIONS } };
  }
  return undefined;
}

/**
 * VectorStore を検索して、関連する人物・設定のテキスト配列を返す。
 * 生成エンドポイントのコンテキスト構築に使用する。
 */
export async function searchContext(
  vectorStore: VectorStore,
  embedding: EmbeddingModel,
  novelId: string,
  options: SearchContextOptions,
  env: Env,
): Promise<SearchContextResult> {
  const topK = options.topK ?? 5;
  const providerOptions = buildEmbeddingProviderOptions(env);
  const queryVector = await generateEmbedding(embedding, options.query, { providerOptions });

  const [characterResults, settingResults] = await Promise.all([
    vectorStore.search(queryVector, {
      novelId,
      entityType: 'character',
      topK,
    }),
    vectorStore.search(queryVector, {
      novelId,
      entityType: 'setting',
      topK,
    }),
  ]);

  return {
    characters: characterResults.map((r) => r.content),
    settings: settingResults.map((r) => r.content),
    previousContent: options.previousContent,
  };
}

/**
 * エンティティのテキストをベクトル化して VectorStore に upsert する。
 * 既存のエントリは entityType + entityId で削除してから再登録する。
 */
export async function upsertEntityEmbedding(
  vectorStore: VectorStore,
  embedding: EmbeddingModel,
  novelId: string,
  entityType: string,
  entityId: string,
  content: string,
  env: Env,
): Promise<void> {
  const providerOptions = buildEmbeddingProviderOptions(env);
  const vector = await generateEmbedding(embedding, content, { providerOptions });
  await vectorStore.deleteByEntity(entityType, entityId);
  await vectorStore.upsert({
    id: randomUUID(),
    novelId,
    entityType,
    entityId,
    content,
    embedding: vector,
  });
}
