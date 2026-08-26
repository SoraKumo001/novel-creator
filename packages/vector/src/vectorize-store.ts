import type { VectorRecord, VectorSearchResult, VectorStore } from './types.js';

/**
 * Cloudflare Vectorize 向けの実装（移行用）。
 * 実際の Cloudflare Workers 環境でのみ動作する。
 * binding は Cloudflare Workers の Vectorize binding。
 */
export function createVectorizeStore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  binding: any,
): VectorStore {
  return {
    async upsert(record: VectorRecord): Promise<void> {
      await binding.upsert([
        {
          id: record.id,
          values: record.embedding,
          metadata: {
            novelId: record.novelId,
            entityType: record.entityType,
            entityId: record.entityId,
            content: record.content,
            ...(record.metadata ?? {}),
          },
        },
      ]);
    },

    async upsertBatch(records: VectorRecord[]): Promise<void> {
      if (records.length === 0) return;
      await binding.upsert(
        records.map((record) => ({
          id: record.id,
          values: record.embedding,
          metadata: {
            novelId: record.novelId,
            entityType: record.entityType,
            entityId: record.entityId,
            content: record.content,
            ...(record.metadata ?? {}),
          },
        })),
      );
    },

    async search(
      query: number[],
      options: { novelId?: string; entityType?: string; topK?: number } = {},
    ): Promise<VectorSearchResult[]> {
      const topK = options.topK ?? 10;
      const filter: Record<string, unknown> = {};
      if (options.novelId) filter.novelId = options.novelId;
      if (options.entityType) filter.entityType = options.entityType;

      const result = await binding.query(query, {
        topK,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        returnMetadata: 'all',
      });

      const matches = result.matches ?? [];
      return matches.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (match: any) => ({
          id: match.id,
          content: match.metadata?.content ?? '',
          entityType: match.metadata?.entityType ?? '',
          entityId: match.metadata?.entityId ?? '',
          metadata: match.metadata ?? undefined,
          score: match.score ?? 0,
        }),
      );
    },

    async delete(id: string): Promise<void> {
      await binding.deleteByIds([id]);
    },

    async deleteByEntity(entityType: string, entityId: string): Promise<void> {
      const result = await binding.query([], {
        topK: 1000,
        filter: { entityType, entityId },
        returnMetadata: 'none',
      });
      const ids = (result.matches ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (match: any) => match.id,
      );
      if (ids.length > 0) {
        await binding.deleteByIds(ids);
      }
    },

    async deleteByNovel(novelId: string): Promise<void> {
      const result = await binding.query([], {
        topK: 1000,
        filter: { novelId },
        returnMetadata: 'none',
      });
      const ids = (result.matches ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (match: any) => match.id,
      );
      if (ids.length > 0) {
        await binding.deleteByIds(ids);
      }
    },
  };
}
