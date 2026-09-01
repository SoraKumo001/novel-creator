import { and, cosineDistance, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { Pool } from "pg";

import type { VectorRecord, VectorSearchResult, VectorStore } from "./types.js";

export const vectorEmbeddings = pgTable(
  "vector_embeddings",
  {
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    embedding: vector("embedding", { dimensions: 3072 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    entityType: text("entity_type").notNull(),
    id: uuid("id").primaryKey(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    novelId: uuid("novel_id").notNull(),
  },
  (table) => [
    index("vector_embeddings_novel_entity_idx").on(
      table.novelId,
      table.entityType
    ),
    index("vector_embeddings_embedding_idx")
      .using("ivfflat", table.embedding.op("vector_cosine_ops"))
      .with({ lists: 100 }),
  ]
);

export type VectorEmbedding = typeof vectorEmbeddings.$inferSelect;
export type NewVectorEmbedding = typeof vectorEmbeddings.$inferInsert;

export function createPgVectorStore(
  connectionString: string,
  dimensions = 1536
): VectorStore {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema: { vectorEmbeddings } });

  let schemaReady: Promise<void> | null = null;
  function ensureSchema(): Promise<void> {
    if (!schemaReady) {
      schemaReady = (async () => {
        // 既存テーブルの embedding 列の次元が要求次元と一致することを検証する。
        // 不一致の場合は CREATE TABLE IF NOT EXISTS が何もせず、insert 時に初めて失敗するため、ここで早期に検出する。
        await validateExistingTableDimension();
        // ivfflat は2000次元まで、HNSW はそれ以上に対応
        const indexType = dimensions > 2000 ? "hnsw" : "ivfflat";
        const indexOptions =
          indexType === "hnsw"
            ? "WITH (m = 16, ef_construction = 64)"
            : "WITH (lists = 100)";
        await db.execute(
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
        `)
        );
      })();
    }
    return schemaReady;
  }

  /**
   * 既存テーブルの embedding 列の次元（atttypmod）を pg_catalog から取得し、
   * 要求次元と一致しなければ明確なエラーを投げる。
   * テーブルが存在しない場合は検証をスキップする（CREATE TABLE IF NOT EXISTS に任せる）。
   */
  async function validateExistingTableDimension(): Promise<void> {
    // pgvector の vector(n) は pg_attribute.atttypmod に次元 n を格納する。
    // to_regclass はテーブルが存在しない場合に NULL を返すため、新規作成時は安全にスキップできる。
    const result = await db.execute(
      sql.raw(`
        SELECT a.atttypmod AS dimensions
        FROM pg_attribute a
        WHERE a.attrelid = to_regclass('vector_embeddings')
          AND a.attname = 'embedding'
          AND a.attnum > 0
          AND NOT a.attisdropped
        LIMIT 1
      `)
    );
    const row = result.rows[0] as { dimensions?: unknown } | undefined;
    if (!row || row.dimensions == null) {
      return;
    }

    const existingDimensions = Number(row.dimensions);
    if (existingDimensions !== dimensions) {
      throw new Error(
        `vector_embeddings テーブルの embedding 列の次元（${existingDimensions}）が` +
          `要求された次元（${dimensions}）と一致しません。` +
          "次元のソースは環境変数 EMBEDDING_DIMENSIONS のほか、DB の embedding 設定" +
          "（embedding_configs テーブルの dimensions カラム）の場合もあります。" +
          "環境変数または embedding 設定の dimensions を既存テーブルの次元に合わせるか、" +
          "recreateSchema でテーブルを作り直してください。"
      );
    }
  }

  return {
    async clearAll(): Promise<void> {
      await ensureSchema();
      await db.delete(vectorEmbeddings);
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
          and(
            eq(vectorEmbeddings.entityType, entityType),
            eq(vectorEmbeddings.entityId, entityId)
          )
        );
    },

    async deleteByNovel(novelId: string): Promise<void> {
      await ensureSchema();
      await db
        .delete(vectorEmbeddings)
        .where(eq(vectorEmbeddings.novelId, novelId));
    },

    async recreateSchema(newDimensions: number): Promise<void> {
      const indexType = newDimensions > 2000 ? "hnsw" : "ivfflat";
      const indexOptions =
        indexType === "hnsw"
          ? "WITH (m = 16, ef_construction = 64)"
          : "WITH (lists = 100)";
      await db.execute(
        sql.raw(`
        DROP TABLE IF EXISTS vector_embeddings CASCADE;
        CREATE TABLE vector_embeddings (
          id uuid PRIMARY KEY,
          novel_id uuid NOT NULL,
          entity_type text NOT NULL,
          entity_id uuid NOT NULL,
          content text NOT NULL,
          metadata jsonb,
          embedding vector(${newDimensions}) NOT NULL,
          created_at timestamp DEFAULT now()
        );
        CREATE INDEX vector_embeddings_novel_entity_idx
          ON vector_embeddings (novel_id, entity_type);
        CREATE INDEX vector_embeddings_embedding_idx
          ON vector_embeddings USING ${indexType} (embedding vector_cosine_ops) ${indexOptions};
      `)
      );
      schemaReady = Promise.resolve();
    },

    async search(
      query: number[],
      options: { novelId?: string; entityType?: string; topK?: number } = {}
    ): Promise<VectorSearchResult[]> {
      await ensureSchema();
      const topK = options.topK ?? 10;
      const conditions = [];
      if (options.novelId) {
        conditions.push(eq(vectorEmbeddings.novelId, options.novelId));
      }
      if (options.entityType) {
        conditions.push(eq(vectorEmbeddings.entityType, options.entityType));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          content: vectorEmbeddings.content,
          distance: cosineDistance(vectorEmbeddings.embedding, query).as(
            "distance"
          ),
          entityId: vectorEmbeddings.entityId,
          entityType: vectorEmbeddings.entityType,
          id: vectorEmbeddings.id,
          metadata: vectorEmbeddings.metadata,
        })
        .from(vectorEmbeddings)
        .where(where)
        .orderBy((fields) => fields.distance)
        .limit(topK);

      return rows.map((row) => ({
        content: row.content,
        entityId: row.entityId,
        entityType: row.entityType,
        id: row.id,
        metadata: row.metadata ?? undefined,
        score: 1 - (row.distance as number),
      }));
    },
    async upsert(record: VectorRecord): Promise<void> {
      await ensureSchema();
      await db
        .insert(vectorEmbeddings)
        .values(toRow(record))
        .onConflictDoUpdate({
          set: {
            content: record.content,
            embedding: record.embedding,
            entityId: record.entityId,
            entityType: record.entityType,
            metadata: record.metadata ?? null,
            novelId: record.novelId,
          },
          target: vectorEmbeddings.id,
        });
    },

    async upsertBatch(records: VectorRecord[]): Promise<void> {
      if (records.length === 0) {
        return;
      }
      await ensureSchema();
      await db.transaction(async (tx) => {
        for (const record of records) {
          await tx
            .insert(vectorEmbeddings)
            .values(toRow(record))
            .onConflictDoUpdate({
              set: {
                content: record.content,
                embedding: record.embedding,
                entityId: record.entityId,
                entityType: record.entityType,
                metadata: record.metadata ?? null,
                novelId: record.novelId,
              },
              target: vectorEmbeddings.id,
            });
        }
      });
    },
  };
}

function toRow(record: VectorRecord): NewVectorEmbedding {
  return {
    content: record.content,
    embedding: record.embedding,
    entityId: record.entityId,
    entityType: record.entityType,
    id: record.id,
    metadata: record.metadata ?? null,
    novelId: record.novelId,
  };
}
