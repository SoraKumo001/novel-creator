import {
  createDb,
  createDbForHyperdrive,
  type Database,
} from "@novel-creator/db";
import { createEmbeddingProvider, createLLMProvider } from "@novel-creator/llm";
import type { Env } from "@novel-creator/shared";
import {
  createVectorStore,
  type VectorizeBinding,
  type VectorStore,
} from "@novel-creator/vector";
import type { EmbeddingModel, LanguageModel } from "ai";
import type { Env as HonoEnv } from "hono";

/**
 * Hono の Context 変数として注入される DI コンテキスト。
 */
export interface AuthUser {
  email: string;
  emailVerified: boolean;
  id: string;
  image?: string | null;
  name: string;
  role?: string | null;
}

export interface AuthSession {
  expiresAt: Date;
  id: string;
  token: string;
  userId: string;
}

export interface AppContext extends HonoEnv {
  Variables: {
    env: Env;
    db: Database;
    llm: LanguageModel;
    embedding: EmbeddingModel;
    vectorStore: VectorStore;
    user?: AuthUser;
    session?: AuthSession;
  };
}

/**
 * 環境変数から全依存関係を初期化して DI コンテキストを構築する。
 */
export function createContext(env: Env): AppContext["Variables"] {
  const db = createDb(env.DATABASE_URL);
  const llm = createLLMProvider(env);
  const embedding = createEmbeddingProvider(env);
  const vectorStore = createVectorStore(env);
  return { db, embedding, env, llm, vectorStore };
}

/**
 * Cloudflare Workers 環境向けに全依存関係を初期化して DI コンテキストを構築する。
 * Hyperdrive 経由で DB に接続し、Vectorize binding をベクトルストアとして使用する。
 */
export function createContextForWorkers(
  env: Env,
  bindings: { hyperdrive: Hyperdrive; vectorize: VectorizeBinding }
): AppContext["Variables"] {
  const db = createDbForHyperdrive(bindings.hyperdrive);
  const llm = createLLMProvider(env);
  const embedding = createEmbeddingProvider(env);
  const vectorStore = createVectorStore(env, {
    vectorizeBinding: bindings.vectorize,
  });
  return { db, embedding, env, llm, vectorStore };
}

/**
 * Cloudflare Hyperdrive binding の最小型定義。
 */
export interface Hyperdrive {
  connectionString: string;
}
