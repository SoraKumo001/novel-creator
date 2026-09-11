import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { getSearchPath } from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ルートの .env ファイルが存在すればロードする
const rootEnvPath = path.resolve(__dirname, "../../../.env");
if (fs.existsSync(rootEnvPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(rootEnvPath);
}

async function runReset() {
  const connectionString =
    process.env.DATABASE_URL ?? "postgres://novel:novel@localhost:5433/novel";
  const searchPath = getSearchPath(connectionString);
  console.log(
    `[db:reset] Connecting to ${connectionString} (schema: ${searchPath})...`
  );

  const pool = new Pool({
    connectionString,
    options: `-c search_path=${searchPath},public`,
  });

  try {
    const safeSchemaName = searchPath.replace(/"/g, '""');
    console.log(`[db:reset] Dropping schema "${searchPath}" (CASCADE)...`);
    await pool.query(`DROP SCHEMA IF EXISTS "${safeSchemaName}" CASCADE;`);
    console.log(`[db:reset] Re-creating schema "${searchPath}"...`);
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${safeSchemaName}";`);

    // public の場合は拡張機能 vector を再作成
    if (searchPath === "public") {
      await pool.query("CREATE EXTENSION IF NOT EXISTS vector;");
    }

    console.log(`[db:reset] Schema "${searchPath}" reset successfully.`);
  } catch (err) {
    console.error("[db:reset] Reset failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void runReset();
