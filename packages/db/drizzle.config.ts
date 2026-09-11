import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ルートの .env ファイルが存在すればロードする
const rootEnvPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(rootEnvPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(rootEnvPath);
}

const connectionString =
  process.env.DATABASE_URL ?? "postgres://novel:novel@localhost:5433/novel";
const url = new URL(connectionString);
const searchPath = url.searchParams.get("schema") ?? "public";

export default defineConfig({
  dbCredentials: {
    url: connectionString,
  },
  dialect: "postgresql",
  migrations: {
    schema: searchPath,
  },
  out: "./drizzle",
  schema: "./src/schema/index.ts",
});
