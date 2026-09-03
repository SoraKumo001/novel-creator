import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { parseEnv } from "@novel-creator/shared/env";
import { config } from "dotenv";

import { createApp } from "./app.js";
import { createContext } from "./context.js";
import { appLogger } from "./middleware/logger.js";

// ワークスペースルートの .env を確実に読み込む
const currentDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(currentDir, "../../../.env") });
config(); // カレントディレクトリの .env もフォールバックで読み込む

const env = parseEnv();
appLogger.info("env loaded:", {
  EMBEDDING_API_KEY_SET: !!env.EMBEDDING_API_KEY,
  EMBEDDING_MODEL: env.EMBEDDING_MODEL,
  EMBEDDING_PROVIDER: env.EMBEDDING_PROVIDER,
  LLM_MODEL: env.LLM_MODEL,
  LLM_PROVIDER: env.LLM_PROVIDER,
});
const context = createContext(env);
const app = createApp(context);

const port = 3000;
appLogger.info(`Starting server on http://localhost:${port}`);

serve({ fetch: app.fetch, port }, (info) => {
  appLogger.info(`Listening on http://localhost:${info.port}`);
});

export { type ApiType, type AppType, api, createApp } from "./app.js";
export type { BackupBody } from "./core/backup.service.js";
