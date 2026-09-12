-- Phase3-3b (FTS+RRF): vector_embeddings 全文検索用カラム + GIN インデックス。
-- 日本語は simple tsvector + trigram の二本立て（pg_bigm 不採用）。
-- HNSW/ivfflat ベクトルインデックスとは独立（競合なし）。すべて IF NOT EXISTS 付きで冪等。
-- Revert: 下記 DOWN ブロックを手動実行（drizzle は down 自動実行なし）。
--   DROP INDEX IF EXISTS vector_embeddings_content_trgm_idx;
--   DROP INDEX IF EXISTS vector_embeddings_content_tsv_idx;
--   ALTER TABLE "vector_embeddings" DROP COLUMN IF EXISTS "content_tsv";
-- 縮小運用: pg_trgm を作成できない権限では CREATE EXTENSION / trgm index をスキップし、
-- content_tsv (simple) のみに縮小する。
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
ALTER TABLE "vector_embeddings" ADD COLUMN IF NOT EXISTS "content_tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', "content")) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vector_embeddings_content_tsv_idx"
  ON "vector_embeddings" USING gin ("content_tsv");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vector_embeddings_content_trgm_idx"
  ON "vector_embeddings" USING gin ("content" gin_trgm_ops);
