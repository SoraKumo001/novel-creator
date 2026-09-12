import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { getSearchPath } from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ルートの .env ファイルが存在すればロードする
const rootEnvPath = path.resolve(__dirname, "../../../.env");
if (fs.existsSync(rootEnvPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(rootEnvPath);
}

async function runMigrate() {
  const connectionString =
    process.env.DATABASE_URL ?? "postgres://novel:novel@localhost:5433/novel";
  const searchPath = getSearchPath(connectionString);
  console.log(
    `[db:migrate] Connecting to ${connectionString} (schema: ${searchPath})...`
  );

  const pool = new Pool({
    connectionString,
    options: `-c search_path=${searchPath},public`,
  });

  try {
    // 対象スキーマが存在しない場合は作成する
    if (searchPath !== "public") {
      // 識別子として安全にエスケープ（ダブルクォート内のダブルクォートを二重化）
      const safeSchemaName = searchPath.replace(/"/g, '""');
      await pool.query(`CREATE SCHEMA IF NOT EXISTS "${safeSchemaName}";`);
    }

    // pgvector 拡張機能が存在しない場合は作成する
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector;");
    console.log('[db:migrate] Ensured extension "vector" exists.');

    // Phase3-3b (FTS+RRF): 日本語全文検索用の trigram 拡張を作成する。
    // 権限不足で作成できない環境では simple tsvector のみに縮小する（0005 migration 参照）。
    await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
    console.log('[db:migrate] Ensured extension "pg_trgm" exists.');

    const db = drizzle(pool);
    const migrationsFolder = path.resolve(__dirname, "../drizzle");
    console.log(
      `[db:migrate] Applying migrations from ${migrationsFolder} to schema "${searchPath}"...`
    );
    await migrate(db, {
      migrationsFolder,
      migrationsSchema: searchPath,
    });
    console.log("[db:migrate] Migrations completed successfully.");
  } catch (err) {
    console.error("[db:migrate] Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void runMigrate();
