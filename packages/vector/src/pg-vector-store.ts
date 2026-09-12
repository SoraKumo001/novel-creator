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

// Phase3-3b (FTS+RRF) 向けのハイブリッド検索型。
// VectorStore interface 自体は変更しない（既存 search シグネチャ破壊なし・revert 容易のため別 export）。
export interface HybridSearchOptions {
  entityType?: string;
  novelId?: string;
  topK?: number;
}

export interface HybridSearchHits {
  ftsHits: VectorSearchResult[];
  vectorHits: VectorSearchResult[];
}

/** searchHybrid を備えたストア（PG 実装が返す交差型の名前付き別名）。 */
export type HybridCapableStore = VectorStore & {
  searchHybrid(
    queryVector: number[],
    queryText: string,
    options?: HybridSearchOptions
  ): Promise<HybridSearchHits>;
};

/** Vectorize 分岐は searchHybrid を持たないため false を返す。 */
export function supportsHybridSearch(
  store: VectorStore
): store is HybridCapableStore {
  return (
    typeof (store as Partial<HybridCapableStore>).searchHybrid === "function"
  );
}

/** searchHybrid 内部でベクトル側・FTS 側それぞれに確保する件数倍率（topK の 2 倍）。 */
const HYBRID_FETCH_MULTIPLIER = 2;

/**
 * vector_embeddings テーブルの embedding 列の次元（Drizzle スキーマ）と、
 * ストア生成時のデフォルト次元を同期させるための共通定数。
 * 変更時は packages/db の embedding_configs.dimensions デフォルトも合わせること。
 */
export const DEFAULT_VECTOR_DIMENSIONS = 3072;

export const vectorEmbeddings = pgTable(
  "vector_embeddings",
  {
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    embedding: vector("embedding", {
      dimensions: DEFAULT_VECTOR_DIMENSIONS,
    }).notNull(),
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
  dimensions = DEFAULT_VECTOR_DIMENSIONS
): HybridCapableStore {
  let searchPath = "public";
  try {
    const url = new URL(connectionString);
    searchPath = url.searchParams.get("schema") ?? "public";
  } catch {
    // connectionString が URL 形式でない場合はデフォルト "public"
  }
  const pool = new Pool({
    connectionString,
    options: `-c search_path=${searchPath},public,extensions`,
  });
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
          CREATE EXTENSION IF NOT EXISTS vector;
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
        // Phase3-3b (FTS+RRF): 全文検索用カラム + GIN インデックスを冪等に追加する。
        // ベクトルインデックス分岐（HNSW/ivfflat）とは独立。権限不足で pg_trgm を
        // 作成できない環境では trigram index のみスキップし simple tsvector に縮小する。
        await ensureFtsSchema();
      })();
    }
    return schemaReady;
  }

  /**
   * FTS 用スキーマ（content_tsv 生成列 + GIN 2件）を冪等に整備する。
   * pg_trgm が利用できない場合は tsvector 側のみ整備して縮小運用する。
   */
  async function ensureFtsSchema(): Promise<void> {
    let trgmAvailable = true;
    try {
      await db.execute(sql.raw("CREATE EXTENSION IF NOT EXISTS pg_trgm;"));
    } catch {
      trgmAvailable = false;
    }
    await db.execute(
      sql.raw(`
        ALTER TABLE vector_embeddings
          ADD COLUMN IF NOT EXISTS content_tsv tsvector
          GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;
        CREATE INDEX IF NOT EXISTS vector_embeddings_content_tsv_idx
          ON vector_embeddings USING gin (content_tsv);
      `)
    );
    if (trgmAvailable) {
      try {
        await db.execute(
          sql.raw(`
            CREATE INDEX IF NOT EXISTS vector_embeddings_content_trgm_idx
              ON vector_embeddings USING gin (content gin_trgm_ops);
          `)
        );
      } catch {
        // pg_trgm 演算子クラスが使えない権限では tsvector のみに縮小する。
      }
    }
  }

  /**
   * 既存テーブルの embedding 列の次元（atttypmod）を pg_catalog から取得し、
   * 要求次元と一致しなければ明確なエラーを投げる。
   * テーブルが存在しない場合は検証をスキップする（CREATE TABLE IF NOT EXISTS に任せる）。
   */
  async function validateExistingTableDimension(): Promise<void> {
    // pgvector の vector(n) は pg_attribute.atttypmod に次元 n を格納する。
    // to_regclass(current_schema() || '.vector_embeddings') で現在のターゲットスキーマ内のテーブルのみを対象とする。
    // テーブルが存在しない場合は NULL を返すため、新規作成時は安全にスキップできる。
    const result = await db.execute(
      sql.raw(`
        SELECT a.atttypmod AS dimensions
        FROM pg_attribute a
        WHERE a.attrelid = to_regclass(current_schema() || '.vector_embeddings')
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

  /**
   * ベクトル類似検索の実体。search / searchHybrid のベクトル側で共有する。
   * search のシグネチャ・振る舞い（score = 1 - cosineDistance、minScore 足切り）は不変。
   */
  async function vectorSearch(
    query: number[],
    options: {
      minScore?: number;
      novelId?: string;
      entityType?: string;
      topK?: number;
    } = {}
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

    const results = rows.map((row) => ({
      content: row.content,
      entityId: row.entityId,
      entityType: row.entityType,
      id: row.id,
      metadata: row.metadata ?? undefined,
      score: 1 - (row.distance as number),
    }));

    if (options.minScore !== undefined) {
      return results.filter((r) => r.score >= (options.minScore as number));
    }
    return results;
  }

  interface FtsRow {
    content: string;
    entityId: string;
    entityType: string;
    id: string;
    metadata: Record<string, unknown> | null;
    rank: number;
    sim: number | null;
  }

  function toFtsResult(row: FtsRow, withTrigram: boolean): VectorSearchResult {
    const rank = Number(row.rank) || 0;
    // ts_rank（0〜概ね1）と trigram 類似度（0〜1）を 0〜1 に正規化する。
    // RRF では順位のみを用いるため、score は下流の minScore 足切りとの互換用である。
    const rankNorm = rank / (rank + 1);
    const sim = withTrigram ? Number(row.sim) || 0 : 0;
    const score = withTrigram ? rankNorm * 0.5 + sim * 0.5 : rankNorm;
    return {
      content: row.content,
      entityId: row.entityId,
      entityType: row.entityType,
      id: row.id,
      metadata: row.metadata ?? undefined,
      score,
    };
  }

  function isMissingTrgmError(error: unknown): boolean {
    const message = errorMessage(error);
    return (
      /function\s+similarity\s*\(.*\)\s+does not exist/i.test(message) ||
      /operator\s+does not exist/i.test(message) ||
      (message.includes("pg_trgm") &&
        /does not exist|permission denied/i.test(message)) ||
      /operator class/i.test(message)
    );
  }

  function isMissingColumnError(error: unknown): boolean {
    // NOTE: ラップされたエラー文には実行 SQL（content_tsv を含む）が echo
    // される場合があるため、裸の部分一致ではなく厳密な欠落パターンで判定する。
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "42703" &&
      errorMessage(error).includes("content_tsv")
    ) {
      return true;
    }
    return /column\s+"?content_tsv"?\s+does not exist/i.test(
      errorMessage(error)
    );
  }

  function errorMessage(error: unknown): string {
    // drizzle は pg エラーを "Failed query: <SQL>" でラップし原因を cause に
    // 入れるため、チェーン全体を連結して判定する。
    const parts: string[] = [];
    const seen = new Set<unknown>();
    let current: unknown = error;
    while (current !== null && current !== undefined && !seen.has(current)) {
      seen.add(current);
      if (current instanceof Error) {
        parts.push(current.message);
        current = (current as { cause?: unknown }).cause;
      } else if (typeof current === "object" && "message" in current) {
        parts.push(String((current as { message: unknown }).message));
        current = (current as { cause?: unknown }).cause;
      } else {
        parts.push(String(current));
        break;
      }
    }
    return parts.join("\nCaused by: ");
  }

  /**
   * 全文検索側の取得（ts_rank + trigram の二本立て）。
   * 生成列 content_tsv を直接参照することで content_tsv GIN が効く。
   * （式 to_tsvector(...) を書くと生成列のインデックスにマッチしない）
   * 日本語の分かち書きなしテキストでも別名・表記揺れを拾えるよう、
   * tsvector 一致 OR trigram 類似 OR 部分一致（LIKE）のいずれかで候補化する。
   * LIKE '%...%' も trigram GIN で加速される。pg_trgm が使えない権限では
   * tsvector + LIKE のみに、content_tsv 列が無い古いスキーマでは式版に縮小して
   * 継続する（呼び出し側への例外なし）。
   */
  async function ftsSearch(
    queryText: string,
    options: HybridSearchOptions,
    fetchK: number,
    useColumn = true
  ): Promise<VectorSearchResult[]> {
    if (queryText.trim().length === 0) {
      return [];
    }
    const novelFilter =
      options.novelId === undefined
        ? sql``
        : sql`AND novel_id = ${options.novelId}::uuid`;
    const entityFilter =
      options.entityType === undefined
        ? sql``
        : sql`AND entity_type = ${options.entityType}`;
    // 生成列を直接参照して GIN を効かせる。列が無いスキーマでは式に縮小する。
    const tsvExpr = useColumn
      ? sql`content_tsv`
      : sql`to_tsvector('simple', content)`;
    const rankExpr = sql`ts_rank(${tsvExpr}, plainto_tsquery('simple', ${queryText}))`;
    // フル版: ts_rank + similarity + trigram GIN が効く 3 条件。
    const fullQuery = sql`
      SELECT id AS "id", novel_id AS "novelId", entity_type AS "entityType",
        entity_id AS "entityId", content AS "content", metadata AS "metadata",
        ${rankExpr} AS "rank",
        similarity(content, ${queryText}) AS "sim"
      FROM vector_embeddings
      WHERE (
        ${tsvExpr} @@ plainto_tsquery('simple', ${queryText})
        OR content % ${queryText}
        OR content LIKE '%' || ${queryText} || '%'
      )
      ${novelFilter} ${entityFilter}
      ORDER BY "rank" DESC, "sim" DESC
      LIMIT ${fetchK}
    `;
    try {
      const result = await db.execute(fullQuery);
      return (result.rows as unknown as FtsRow[]).map((row) =>
        toFtsResult(row, true)
      );
    } catch (error) {
      if (useColumn && isMissingColumnError(error)) {
        // content_tsv 列が無いスキーマでは式版に縮小して再試行する。
        return ftsSearch(queryText, options, fetchK, false);
      }
      if (!isMissingTrgmError(error)) {
        throw error;
      }
      // 縮小運用: tsvector + LIKE のみで再試行する。
      const fallbackQuery = sql`
        SELECT id AS "id", novel_id AS "novelId", entity_type AS "entityType",
          entity_id AS "entityId", content AS "content", metadata AS "metadata",
          ${rankExpr} AS "rank",
          0 AS "sim"
        FROM vector_embeddings
        WHERE (
          ${tsvExpr} @@ plainto_tsquery('simple', ${queryText})
          OR content LIKE '%' || ${queryText} || '%'
        )
        ${novelFilter} ${entityFilter}
        ORDER BY "rank" DESC
        LIMIT ${fetchK}
      `;
      try {
        const result = await db.execute(fallbackQuery);
        return (result.rows as unknown as FtsRow[]).map((row) =>
          toFtsResult(row, false)
        );
      } catch (fallbackError) {
        if (useColumn && isMissingColumnError(fallbackError)) {
          return ftsSearch(queryText, options, fetchK, false);
        }
        throw fallbackError;
      }
    }
  }

  /**
   * Phase3-3b ハイブリッド検索の実体。ベクトル距離順と FTS 順を
   * それぞれ LIMIT 2*topK で並列取得する。融合（RRF）は呼び出し側で行う。
   */
  async function searchHybrid(
    queryVector: number[],
    queryText: string,
    options: HybridSearchOptions = {}
  ): Promise<HybridSearchHits> {
    const topK = options.topK ?? 10;
    const fetchK = Math.max(1, topK * HYBRID_FETCH_MULTIPLIER);
    const [vectorHits, ftsHits] = await Promise.all([
      vectorSearch(queryVector, { ...options, topK: fetchK }),
      ftsSearch(queryText, options, fetchK),
    ]);
    return { ftsHits, vectorHits };
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
        CREATE EXTENSION IF NOT EXISTS vector;
        DROP TABLE IF EXISTS vector_embeddings CASCADE;
        CREATE TABLE vector_embeddings (
          id uuid PRIMARY KEY,
          novel_id uuid NOT NULL,
          entity_type text NOT NULL,
          entity_id uuid NOT NULL,
          content text NOT NULL,
          content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
          metadata jsonb,
          embedding vector(${newDimensions}) NOT NULL,
          created_at timestamp DEFAULT now()
        );
        CREATE INDEX vector_embeddings_novel_entity_idx
          ON vector_embeddings (novel_id, entity_type);
        CREATE INDEX vector_embeddings_embedding_idx
          ON vector_embeddings USING ${indexType} (embedding vector_cosine_ops) ${indexOptions};
        CREATE INDEX vector_embeddings_content_tsv_idx
          ON vector_embeddings USING gin (content_tsv);
      `)
      );
      // trigram 側は pg_trgm が使えない権限ではスキップし tsvector のみに縮小する。
      try {
        await db.execute(sql.raw("CREATE EXTENSION IF NOT EXISTS pg_trgm;"));
        await db.execute(
          sql.raw(`
          CREATE INDEX vector_embeddings_content_trgm_idx
            ON vector_embeddings USING gin (content gin_trgm_ops);
        `)
        );
      } catch {
        // 縮小運用: content_tsv のみで継続する。
      }
      schemaReady = Promise.resolve();
    },

    search: vectorSearch,
    searchHybrid,

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
