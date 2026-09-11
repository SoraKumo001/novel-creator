import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { getSearchPath } from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      console.log(`[db:migrate] Ensured schema "${searchPath}" exists.`);
    }

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
