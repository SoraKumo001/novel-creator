import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dbCredentials: {
    url:
      process.env.DATABASE_URL ?? "postgres://novel:novel@localhost:5433/novel",
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/schema/index.ts",
});
