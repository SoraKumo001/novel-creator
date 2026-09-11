import path from "node:path";
import { parseEnv } from "@novel-creator/shared/env";
import { config } from "dotenv";
import { createContext } from "./context.js";
import { ReindexDomainService } from "./core/reindex.service.js";

config({ path: path.resolve(process.cwd(), "../../.env") });
const env = parseEnv();

console.log("ENV CONFIG:", {
  DATABASE_URL: env.DATABASE_URL,
  EMBEDDING_PROVIDER: env.EMBEDDING_PROVIDER,
  EMBEDDING_MODEL: env.EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS: env.EMBEDDING_DIMENSIONS,
});

async function main() {
  const ctx = createContext(env);
  const reindexService = new ReindexDomainService(ctx.services.reindex["ctx"]);

  console.log("Starting reindexAll...");
  try {
    const result = await reindexService.reindexAll(null, (progress) => {
      console.log("PROGRESS:", progress);
    });
    console.log("RESULT:", result);
  } catch (err) {
    console.error("REINDEX ERROR:", err);
  }
}

main().catch(console.error);
