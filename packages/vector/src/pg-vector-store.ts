import { and, cosineDistance, eq, sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import type { VectorRecord, VectorSearchResult, VectorStore } from './types.js';

export const vectorEmbeddings = pgTable(
  'vector_embeddings',
  {
    id: uuid('id').primaryKey(),
    novelId: uuid('novel_id').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    content: text('content').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    embedding: vector('embedding', { dimensions: 3072 }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('vector_embeddings_novel_entity_idx').on(table.novelId, table.entityType),
    index('vector_embeddings_embedding_idx')
      .using('ivfflat', table.embedding.op('vector_cosine_ops'))
      .with({ lists: 100 }),
  ],
);

export type VectorEmbedding = typeof vectorEmbeddings.$inferSelect;
export type NewVectorEmbedding = typeof vectorEmbeddings.$inferInsert;

export function createPgVectorStore(connectionString: string, dimensions = 3072): VectorStore {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema: { vectorEmbeddings } });

  let schemaReady: Promise<void> | null = null;
  function ensureSchema(): Promise<void> {
    if (!schemaReady) {
      // ivfflat は2000次元まで、HNSW はそれ以上に対応
      const indexType = dimensions > 2000 ? 'hnsw' : 'ivfflat';
      const indexOptions =
        indexType === 'hnsw' ? 'WITH (m = 16, ef_construction = 64)' : 'WITH (lists = 100)';
      schemaReady = db
        .execute(
          sql.raw(`
          CREATE TABLE IF NOT EXISTS vector_embeddings (
            id uuid PRIMARY KEY,
            novel_id uuid NOT NULL,
            entity_type text NOT NULL,
            entity_id uuid NOT NULL,
            content text NOT NULL,
            metadata jsonb,
            embedding vector(${dimensions}) NOT NULL,
            created_at timestamp DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS vector_embeddings_novel_entity_idx
            ON vector_embeddings (novel_id, entity_type);
          CREATE INDEX IF NOT EXISTS vector_embeddings_embedding_idx
            ON vector_embeddings USING ${indexType} (embedding vector_cosine_ops) ${indexOptions};
        `),
        )
        .then(() => undefined);
    }
    return schemaReady;
  }

  return {
    async upsert(record: VectorRecord): Promise<void> {
      await ensureSchema();
      await db
        .insert(vectorEmbeddings)
        .values(toRow(record))
        .onConflictDoUpdate({
          target: vectorEmbeddings.id,
          set: {
            novelId: record.novelId,
            entityType: record.entityType,
            entityId: record.entityId,
            content: record.content,
            metadata: record.metadata ?? null,
            embedding: record.embedding,
          },
        });
    },

    async upsertBatch(records: VectorRecord[]): Promise<void> {
      if (records.length === 0) return;
      await ensureSchema();
      await db.transaction(async (tx) => {
        for (const record of records) {
          await tx
            .insert(vectorEmbeddings)
            .values(toRow(record))
            .onConflictDoUpdate({
              target: vectorEmbeddings.id,
              set: {
                novelId: record.novelId,
                entityType: record.entityType,
                entityId: record.entityId,
                content: record.content,
                metadata: record.metadata ?? null,
                embedding: record.embedding,
              },
            });
        }
      });
    },

    async search(
      query: number[],
      options: { novelId?: string; entityType?: string; topK?: number } = {},
    ): Promise<VectorSearchResult[]> {
      await ensureSchema();
      const topK = options.topK ?? 10;
      const conditions = [];
      if (options.novelId) conditions.push(eq(vectorEmbeddings.novelId, options.novelId));
      if (options.entityType) conditions.push(eq(vectorEmbeddings.entityType, options.entityType));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          id: vectorEmbeddings.id,
          content: vectorEmbeddings.content,
          entityType: vectorEmbeddings.entityType,
          entityId: vectorEmbeddings.entityId,
          metadata: vectorEmbeddings.metadata,
          distance: cosineDistance(vectorEmbeddings.embedding, query).as('distance'),
        })
        .from(vectorEmbeddings)
        .where(where)
        .orderBy((fields) => fields.distance)
        .limit(topK);

      return rows.map((row) => ({
        id: row.id,
        content: row.content,
        entityType: row.entityType,
        entityId: row.entityId,
        metadata: row.metadata ?? undefined,
        score: 1 - (row.distance as number),
      }));
    },

    async delete(id: string): Promise<void> {
      await ensureSchema();
      await db.delete(vectorEmbeddings).where(eq(vectorEmbeddings.id, id));
    },

    async deleteByEntity(entityType: string, entityId: string): Promise<void> {
      await ensureSchema();
      await db
        .delete(vectorEmbeddings)
        .where(
          and(eq(vectorEmbeddings.entityType, entityType), eq(vectorEmbeddings.entityId, entityId)),
        );
    },
  };
}

function toRow(record: VectorRecord): NewVectorEmbedding {
  return {
    id: record.id,
    novelId: record.novelId,
    entityType: record.entityType,
    entityId: record.entityId,
    content: record.content,
    metadata: record.metadata ?? null,
    embedding: record.embedding,
  };
}
