import { defineConfig } from "drizzle-kit";

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
