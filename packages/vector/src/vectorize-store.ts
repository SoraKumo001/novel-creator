import type { VectorRecord, VectorSearchResult, VectorStore } from "./types.js";

/**
 * Cloudflare Vectorize binding のうち、このストアが必要とする最小限の型。
 * 実際の型は @cloudflare/workers-types の VectorizeIndex（beta）/ Vectorize を参照する。
 */
export interface VectorizeVectorMutation {
  count?: number;
  ids?: string[];
}

export interface VectorizeMatch {
  id: string;
  metadata?: Record<string, unknown>;
  score?: number;
}

export interface VectorizeMatches {
  count?: number;
  matches?: VectorizeMatch[];
}

export interface VectorizeQueryOptions {
  filter?: Record<string, unknown>;
  returnMetadata?: boolean | "all" | "indexed" | "none";
  topK?: number;
}

export interface VectorizeVectorInput {
  id: string;
  metadata?: Record<string, unknown>;
  values: number[] | Float32Array | Float64Array;
}

/** Cloudflare Workers の Vectorize バインディング。 */
export interface VectorizeBinding {
  deleteByIds(ids: string[]): Promise<VectorizeVectorMutation>;
  describe?(): Promise<unknown>;
  query(
    vector: number[] | Float32Array | Float64Array,
    options?: VectorizeQueryOptions
  ): Promise<VectorizeMatches>;
  upsert(vectors: VectorizeVectorInput[]): Promise<unknown>;
}

/** 1 回の query で取得できる最大件数（Vectorize の topK 上限）。 */
const SCAN_BATCH_SIZE = 1000;

/**
 * Cloudflare Vectorize 向けの実装（移行用）。
 * 実際の Cloudflare Workers 環境でのみ動作する。
 * binding は Cloudflare Workers の Vectorize binding。
 */
export function createVectorizeStore(binding: VectorizeBinding): VectorStore {
  let scanVectorPromise: Promise<number[]> | undefined;

  /**
   * 全件スキャン用のクエリベクトルを解決する。
   * describe() からインデックスの次元を取得してゼロベクトルを作る。
   * 次元を取得できない場合は従来どおり空配列にフォールバックする。
   */
  function resolveScanVector(): Promise<number[]> {
    if (!scanVectorPromise) {
      scanVectorPromise = (async () => {
        const dimensions = await readIndexDimensions(binding);
        return dimensions > 0 ? new Array<number>(dimensions).fill(0) : [];
      })();
    }
    return scanVectorPromise;
  }

  return {
    /**
     * 全レコードを削除する。
     * インストール済みの @cloudflare/vectorize binding には一括削除
     * （deleteAll / truncate）API が提供されていないため、
     * topK スキャンで ID を収集して deleteByIds で削除し、空になるまで繰り返す。
     */
    async clearAll(): Promise<void> {
      await deleteByQuery(binding, undefined, resolveScanVector);
    },

    async delete(id: string): Promise<void> {
      await binding.deleteByIds([id]);
    },

    async deleteByEntity(entityType: string, entityId: string): Promise<void> {
      // topK 上限（1000）を超える件数のベクトルを持つエンティティでも
      // 完全に削除できるよう、クエリ → 削除 → 再クエリを空になるまで繰り返す。
      await deleteByQuery(binding, { entityId, entityType }, resolveScanVector);
    },

    async deleteByNovel(novelId: string): Promise<void> {
      await deleteByQuery(binding, { novelId }, resolveScanVector);
    },

    async search(
      query: number[],
      options: {
        minScore?: number;
        novelId?: string;
        entityType?: string;
        topK?: number;
      } = {}
    ): Promise<VectorSearchResult[]> {
      const topK = options.topK ?? 10;
      const filter: Record<string, unknown> = {};
      if (options.novelId) {
        filter.novelId = options.novelId;
      }
      if (options.entityType) {
        filter.entityType = options.entityType;
      }

      const result = await binding.query(query, {
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        returnMetadata: "all",
        topK,
      });

      const matches = result.matches ?? [];
      const results = matches.map(
        (match): VectorSearchResult => ({
          content: String(match.metadata?.content ?? ""),
          entityId: String(match.metadata?.entityId ?? ""),
          entityType: String(match.metadata?.entityType ?? ""),
          id: match.id,
          metadata: match.metadata ?? undefined,
          score: match.score ?? 0,
        })
      );

      if (options.minScore !== undefined) {
        const minScore = options.minScore;
        return results.filter((r) => r.score >= minScore);
      }
      return results;
    },

    async upsert(record: VectorRecord): Promise<void> {
      await binding.upsert([toVectorizeVector(record)]);
    },

    async upsertBatch(records: VectorRecord[]): Promise<void> {
      if (records.length === 0) {
        return;
      }
      await binding.upsert(records.map(toVectorizeVector));
    },
  };
}

/**
 * フィルタ条件（または全件スキャン）に一致するベクトルを
 * query → deleteByIds を空になるまで繰り返して削除する。
 */
async function deleteByQuery(
  binding: VectorizeBinding,
  filter: Record<string, unknown> | undefined,
  resolveScanVector: () => Promise<number[]>
): Promise<void> {
  const queryVector = await resolveScanVector();
  while (true) {
    const result = await binding.query(queryVector, {
      filter,
      returnMetadata: "none",
      topK: SCAN_BATCH_SIZE,
    });
    const ids = (result.matches ?? []).map((match) => match.id);
    if (ids.length === 0) {
      return;
    }
    await binding.deleteByIds(ids);
  }
}

/** describe() の結果からインデックス次元を読み取る。取得できない場合は 0。 */
async function readIndexDimensions(binding: VectorizeBinding): Promise<number> {
  try {
    const details = await binding.describe?.();
    if (details && typeof details === "object") {
      const record = details as {
        config?: { dimensions?: unknown; preset?: unknown };
        dimensions?: unknown;
      };
      const raw =
        typeof record.dimensions === "number"
          ? record.dimensions
          : typeof record.config?.dimensions === "number"
            ? record.config.dimensions
            : 0;
      return Number.isInteger(raw) && raw > 0 ? raw : 0;
    }
  } catch {
    // describe() が使えない環境では空ベクトルにフォールバックする。
  }
  return 0;
}

function toVectorizeVector(record: VectorRecord): VectorizeVectorInput {
  return {
    id: record.id,
    metadata: {
      content: record.content,
      entityId: record.entityId,
      entityType: record.entityType,
      novelId: record.novelId,
      ...(record.metadata ?? {}),
    },
    values: record.embedding,
  };
}
