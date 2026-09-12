import { beforeAll, describe, expect, it } from "vitest";

// ---- 実 DB 検証（RUN_LIVE_PG=1 のときのみ実行） ----
// ローカル PG（docker compose の db:5433）に対して日本語別名の recall 改善と
// EXPLAIN の GIN 使用を確認する。pg のモックは行わない（別ファイルに分離）。
// 0005 migration と同一内容の DDL を beforeAll で冪等適用する。

const runLive = process.env.RUN_LIVE_PG === "1";
const CONNECTION_STRING = "postgres://novel:novel@localhost:5433/novel";

describe.skipIf(!runLive)("searchHybrid（実 DB）", () => {
  beforeAll(async () => {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: CONNECTION_STRING });
    try {
      await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
      await pool.query(
        `ALTER TABLE vector_embeddings
           ADD COLUMN IF NOT EXISTS content_tsv tsvector
           GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS vector_embeddings_content_tsv_idx
           ON vector_embeddings USING gin (content_tsv);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS vector_embeddings_content_trgm_idx
           ON vector_embeddings USING gin (content gin_trgm_ops);`
      );
    } finally {
      await pool.end();
    }
  });

  it("日本語別名（トーマ→モルテ文書）の recall が改善すること", async () => {
    const { createPgVectorStore } = await import("../src/pg-vector-store.js");
    const { rrfMerge } = await import("../../../apps/api/src/rag-prune.js");
    const store = createPgVectorStore(CONNECTION_STRING, 768);
    // 「トーマ」はモルテ文書の本文中に別名として登場する語。
    const { ftsHits, vectorHits } = await store.searchHybrid(
      new Array<number>(768).fill(0.01),
      "トーマ",
      { entityType: "character", topK: 5 }
    );
    // FTS 側は LIMIT 2*topK 以内で取得すること
    expect(ftsHits.length).toBeGreaterThan(0);
    expect(ftsHits.length).toBeLessThanOrEqual(10);
    expect(ftsHits.some((h) => h.content.includes("トーマ"))).toBe(true);
    // RRF 融合後も別名文書が残ること（ベクトルのみでは埋もれがちな文書の救済）
    const merged = rrfMerge(vectorHits, ftsHits, { topK: 5 });
    expect(merged.some((h) => h.content.includes("トーマ"))).toBe(true);
  });

  it("EXPLAIN で GIN インデックスが使用されること", async () => {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: CONNECTION_STRING });
    try {
      // 小規模テーブルでは Seq Scan が選ばれがちなため SeqScan を止めて
      // GIN パスが利用可能であることを確認する。
      const client = await pool.connect();
      try {
        await client.query("BEGIN;");
        await client.query("SET LOCAL enable_seqscan = OFF;");
        const explain = await client.query(
          `EXPLAIN (COSTS OFF)
           SELECT id FROM vector_embeddings
           WHERE (
             content_tsv @@ plainto_tsquery('simple', 'トーマ')
             OR content % 'トーマ'
             OR content LIKE '%' || 'トーマ' || '%'
           )
           ORDER BY ts_rank(content_tsv, plainto_tsquery('simple', 'トーマ')) DESC
           LIMIT 10`
        );
        await client.query("ROLLBACK;");
        const plan = explain.rows
          .map((r) => String(r["QUERY PLAN"]))
          .join("\n");
        expect(plan).toMatch(
          /vector_embeddings_content_tsv_idx|vector_embeddings_content_trgm_idx/
        );
        expect(plan).toMatch(/Bitmap/);
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  });
});
