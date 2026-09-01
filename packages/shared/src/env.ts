import { z } from 'zod';

import { llmProviders } from './constants.js';

export const envSchema = z.object({
  DATABASE_URL: z.string().default('postgres://novel:novel@localhost:5433/novel'),

  // --- LLM (テキスト生成) ---
  // プロバイダ選択肢は constants.ts の llmProviders に統一（custom_openai を含む）
  LLM_PROVIDER: z.enum(llmProviders).default('openai'),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  LLM_BASE_URL: z.string().optional(),

  // --- Embedding (ベクトル生成) ---
  // 未設定の場合は LLM_* の設定をフォールバック使用する。
  EMBEDDING_PROVIDER: z.enum(llmProviders).optional(),
  EMBEDDING_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDING_BASE_URL: z.string().optional(),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),

  VECTOR_STORE_PROVIDER: z.enum(['pgvector', 'vectorize']).default('pgvector'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}

/**
 * Cloudflare Workers の bindings オブジェクトから環境変数をパースする。
 *
 * 文字列（または undefined）のバインディングのみを環境変数として扱い、
 * Hyperdrive・Vectorize などのオブジェクト型バインディングは無視する。
 * デフォルト値・optional・バリデーションエラー等のパース挙動は parseEnv と完全に同一。
 */
export function parseEnvFromBindings(bindings: Record<string, unknown>): Env {
  const source: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(bindings)) {
    if (typeof value === 'string' || value === undefined) {
      source[key] = value;
    }
  }
  return parseEnv(source);
}
