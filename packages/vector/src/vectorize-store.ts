import type { VectorRecord, VectorSearchResult, VectorStore } from "./types.js";

/**
 * Cloudflare Vectorize 向けの実装（移行用）。
 * 実際の Cloudflare Workers 環境でのみ動作する。
 * binding は Cloudflare Workers の Vectorize binding。
 */
export function createVectorizeStore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  binding: any
): VectorStore {
  return {
    async delete(id: string): Promise<void> {
      await binding.deleteByIds([id]);
    },

    async deleteByEntity(entityType: string, entityId: string): Promise<void> {
      const result = await binding.query([], {
        filter: { entityId, entityType },
        returnMetadata: "none",
        topK: 1000,
      });
      const ids = (result.matches ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (match: any) => match.id
      );
      if (ids.length > 0) {
        await binding.deleteByIds(ids);
      }
    },

    async deleteByNovel(novelId: string): Promise<void> {
      const result = await binding.query([], {
        filter: { novelId },
        returnMetadata: "none",
        topK: 1000,
      });
      const ids = (result.matches ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (match: any) => match.id
      );
      if (ids.length > 0) {
        await binding.deleteByIds(ids);
      }
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (match: any) => ({
          content: match.metadata?.content ?? "",
          entityId: match.metadata?.entityId ?? "",
          entityType: match.metadata?.entityType ?? "",
          id: match.id,
          metadata: match.metadata ?? undefined,
          score: match.score ?? 0,
        })
      );

      if (options.minScore !== undefined) {
        return results.filter(
          (r: VectorSearchResult) => r.score >= (options.minScore as number)
        );
      }
      return results;
    },
    async upsert(record: VectorRecord): Promise<void> {
      await binding.upsert([
        {
          id: record.id,
          metadata: {
            content: record.content,
            entityId: record.entityId,
            entityType: record.entityType,
            novelId: record.novelId,
            ...(record.metadata ?? {}),
          },
          values: record.embedding,
        },
      ]);
    },

    async upsertBatch(records: VectorRecord[]): Promise<void> {
      if (records.length === 0) {
        return;
      }
      await binding.upsert(
        records.map((record) => ({
          id: record.id,
          metadata: {
            content: record.content,
            entityId: record.entityId,
            entityType: record.entityType,
            novelId: record.novelId,
            ...(record.metadata ?? {}),
          },
          values: record.embedding,
        }))
      );
    },
  };
}
