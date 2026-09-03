import { z } from "zod";

import { llmProviders } from "./constants.js";

/** ローカル開発専用のフォールバック接続文字列（本番では使ってはいけない）。 */
const DATABASE_URL_FALLBACK = "postgres://novel:novel@localhost:5433/novel";

export const envSchema = z.object({
  DATABASE_URL: z.string().default(DATABASE_URL_FALLBACK),
  EMBEDDING_API_KEY: z.string().optional(),
  EMBEDDING_BASE_URL: z.string().optional(),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),

  // --- Embedding (ベクトル生成) ---
  // 未設定の場合は LLM_* の設定をフォールバック使用する。
  EMBEDDING_PROVIDER: z.enum(llmProviders).optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.string().optional(),
  LLM_MODEL: z.string().default("gpt-4o-mini"),

  // --- LLM (テキスト生成) ---
  // プロバイダ選択肢は constants.ts の llmProviders に統一（custom_openai を含む）
  LLM_PROVIDER: z.enum(llmProviders).default("openai"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  VECTOR_STORE_PROVIDER: z.enum(["pgvector", "vectorize"]).default("pgvector"),
});

export type Env = z.infer<typeof envSchema>;

let warnedDatabaseUrlFallback = false;

/** 本番環境で DATABASE_URL のフォールバックが使われた場合に一度だけ警告する。 */
function warnDatabaseUrlFallback(): void {
  if (warnedDatabaseUrlFallback) {
    return;
  }
  warnedDatabaseUrlFallback = true;
  console.warn(
    "[env] DATABASE_URL is not set; falling back to the local development default. Set DATABASE_URL when running in production."
  );
}

export function parseEnv(
  source: Record<string, string | undefined> = process.env
): Env {
  const env = envSchema.parse(source);
  if (source.DATABASE_URL === undefined && env.NODE_ENV === "production") {
    warnDatabaseUrlFallback();
  }
  return env;
}

/**
 * Cloudflare Workers の bindings オブジェクトから環境変数をパースする。
 *
 * 文字列（または undefined）のバインディングのみを環境変数として扱い、
 * Hyperdrive・Vectorize などのオブジェクト型バインディングは無視する。
 * デプロイ済みの Workers は必ずバインディング経由で設定を受け取るため、
 * DATABASE_URL は必須（欠落時は即座にエラーを投げる）。
 * それ以外のデフォルト値・optional・バリデーションエラー等のパース挙動は parseEnv と同一。
 */
export function parseEnvFromBindings(bindings: Record<string, unknown>): Env {
  const source: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(bindings)) {
    if (typeof value === "string" || value === undefined) {
      source[key] = value;
    }
  }

  if (!source.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required in Worker bindings. Add it as a string binding (or wire it from a Hyperdrive connection string) before calling parseEnvFromBindings."
    );
  }

  return parseEnv(source);
}
