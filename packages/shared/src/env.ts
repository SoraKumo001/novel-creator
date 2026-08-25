import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().default('postgres://novel:novel@localhost:5433/novel'),

  // --- LLM (テキスト生成) ---
  LLM_PROVIDER: z.enum(['openai', 'anthropic', 'ollama', 'google']).default('openai'),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  LLM_BASE_URL: z.string().optional(),

  // --- Embedding (ベクトル生成) ---
  // 未設定の場合は LLM_* の設定をフォールバック使用する。
  EMBEDDING_PROVIDER: z.enum(['openai', 'anthropic', 'ollama', 'google']).optional(),
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
