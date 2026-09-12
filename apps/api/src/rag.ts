import { randomUUID } from "node:crypto";
import { generateEmbedding } from "@novel-creator/llm";
import type { Env } from "@novel-creator/shared";
import type { VectorStore } from "@novel-creator/vector";
import { supportsHybridSearch } from "@novel-creator/vector";
import type { EmbeddingModel } from "ai";
import { extractQueryTerms, pruneRanked, rrfMerge } from "./rag-prune.js";

export interface SearchContextOptions {
  /** 本文（content）専用の最小スコア（既定: minScore。長文ノイズ抑制のため高めに設定可） */
  contentMinScore?: number;
  /** 本文（content）の最大検索件数（既定: 3。チャンクが長いため少なめに抑える） */
  contentTopK?: number;
  /** 伏線（foreshadowing）の最大検索件数（既定: topK） */
  foreshadowingTopK?: number;
  /** 用語集（glossary）の最大検索件数（既定: topK） */
  glossaryTopK?: number;
  minScore?: number;
  previousContent?: string;
  query: string;
  topK?: number;
}

export interface SearchContextResult {
  characters: string[];
  contents: string[];
  foreshadowings: string[];
  glossaries: string[];
  previousContent?: string;
  settings: string[];
}

/**
 * VectorStore を検索して、関連する人物・設定・本文・伏線・用語集のテキスト配列を返す。
 * 生成エンドポイントのコンテキスト構築に使用する。
 * エンティティタイプごとに件数上限（topK 等）を適用してトークン予算を抑える。
 * 取得時は上限の2倍で検索し、簡易再ランク（pruneRanked）で上位に絞る。
 * 既存4種の返却順序・件数は不変。
 */
export async function searchContext(
  vectorStore: VectorStore,
  embedding: EmbeddingModel,
  novelId: string,
  options: SearchContextOptions,
  env: Env
): Promise<SearchContextResult> {
  const topK = options.topK ?? 5;
  const contentTopK = options.contentTopK ?? 3;
  const foreshadowingTopK = options.foreshadowingTopK ?? topK;
  const glossaryTopK = options.glossaryTopK ?? topK;
  const minScore = options.minScore;
  const contentMinScore = options.contentMinScore ?? minScore;
  const queryVector = await generateEmbedding(embedding, options.query, {
    dimensions: env.EMBEDDING_DIMENSIONS,
  });

  const queryTerms = extractQueryTerms(options.query);

  const [
    characterResults,
    contentResults,
    foreshadowingResults,
    settingResults,
    glossaryResults,
  ] = await Promise.all([
    searchAndPrune(vectorStore, queryVector, options.query, {
      entityType: "character",
      minScore,
      novelId,
      queryTerms,
      searchTopK: topK * 2,
      topK,
    }),
    searchAndPrune(vectorStore, queryVector, options.query, {
      entityType: "content",
      minScore: contentMinScore,
      novelId,
      queryTerms,
      searchTopK: contentTopK * 2,
      topK: contentTopK,
    }),
    searchAndPrune(vectorStore, queryVector, options.query, {
      entityType: "foreshadowing",
      minScore,
      novelId,
      queryTerms,
      searchTopK: foreshadowingTopK * 2,
      topK: foreshadowingTopK,
    }),
    searchAndPrune(vectorStore, queryVector, options.query, {
      entityType: "setting",
      minScore,
      novelId,
      queryTerms,
      searchTopK: topK * 2,
      topK,
    }),
    searchAndPrune(vectorStore, queryVector, options.query, {
      entityType: "glossary",
      minScore,
      novelId,
      queryTerms,
      searchTopK: glossaryTopK * 2,
      topK: glossaryTopK,
    }),
  ]);

  return {
    characters: characterResults,
    contents: contentResults,
    foreshadowings: foreshadowingResults,
    glossaries: glossaryResults,
    previousContent: options.previousContent,
    settings: settingResults,
  };
}

/**
 * Phase3-3b: エンティティタイプ別の検索 + prune を1単位にまとめたヘルパー。
 * PG（searchHybrid 対応）のみ RRF 融合し、Vectorize 分岐（supportsFts 相当 false）や
 * FTS 失敗時は従来の search + pruneRanked にフォールバックする。
 * RRF の後段には既存の minScore/dedup/maxChars（pruneRanked）をそのまま適用する。
 */
async function searchAndPrune(
  vectorStore: VectorStore,
  queryVector: number[],
  queryText: string,
  options: {
    entityType: string;
    minScore?: number;
    novelId: string;
    queryTerms: string[];
    searchTopK: number;
    topK: number;
  }
): Promise<string[]> {
  if (supportsHybridSearch(vectorStore) && queryText.trim().length > 0) {
    try {
      const { ftsHits, vectorHits } = await vectorStore.searchHybrid(
        queryVector,
        queryText,
        {
          entityType: options.entityType,
          novelId: options.novelId,
          topK: options.searchTopK,
        }
      );
      const merged = rrfMerge(vectorHits, ftsHits, {
        topK: options.searchTopK,
      });
      return pruneRanked(merged, {
        minScore: options.minScore,
        queryTerms: options.queryTerms,
        topK: options.topK,
      }).map((r) => r.content);
    } catch {
      // FTS 失敗時は下の従来経路にフォールバックする。
    }
  }
  const results = await vectorStore.search(queryVector, {
    entityType: options.entityType,
    minScore: options.minScore,
    novelId: options.novelId,
    topK: options.searchTopK,
  });
  return pruneRanked(results, {
    minScore: options.minScore,
    queryTerms: options.queryTerms,
    topK: options.topK,
  }).map((r) => r.content);
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
  env: Env
): Promise<void> {
  const vector = await generateEmbedding(embedding, content, {
    dimensions: env.EMBEDDING_DIMENSIONS,
  });
  await vectorStore.deleteByEntity(entityType, entityId);
  await vectorStore.upsert({
    content,
    embedding: vector,
    entityId,
    entityType,
    id: randomUUID(),
    novelId,
  });
}
