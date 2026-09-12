import path from "node:path";
import { parseEnv } from "@novel-creator/shared/env";
import { config } from "dotenv";
import { createContext } from "./context.js";
import { ReindexDomainService } from "./core/reindex.service.js";
import { appLogger } from "./middleware/logger.js";

config({ path: path.resolve(process.cwd(), "../../.env") });
const env = parseEnv();

appLogger.info("ENV CONFIG:", {
  DATABASE_URL: env.DATABASE_URL,
  EMBEDDING_DIMENSIONS: env.EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL: env.EMBEDDING_MODEL,
  EMBEDDING_PROVIDER: env.EMBEDDING_PROVIDER,
});

async function main(): Promise<void> {
  const ctx = createContext(env);
  const reindexService = new ReindexDomainService(ctx.services.reindex["ctx"]);

  appLogger.info("Starting reindexAll...");
  try {
    const result = await reindexService.reindexAll(null, (progress) => {
      appLogger.debug("PROGRESS:", progress);
    });
    appLogger.info("RESULT:", result);
  } catch (err) {
    appLogger.error("REINDEX ERROR:", err);
  }
}

main().catch((err: unknown) => {
  appLogger.error("REINDEX FAILED:", err);
});
