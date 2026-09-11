import {
  createDb,
  createDbForHyperdrive,
  type Database,
} from "@novel-creator/db";
import {
  createEmbeddingProvider,
  createLLMProvider,
  createWorkersAIEmbeddingModel,
  createWorkersAILanguageModel,
  type WorkersAiBinding,
} from "@novel-creator/llm";
import type { Env } from "@novel-creator/shared";
import {
  createVectorStore,
  type VectorizeBinding,
  type VectorStore,
} from "@novel-creator/vector";
import type { EmbeddingModel, LanguageModel } from "ai";
import type { Env as HonoEnv } from "hono";

import { createDomainServices, type DomainServices } from "./core/services.js";
import type { McpAuth } from "./core/types.js";

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
    services: DomainServices;
    mcpAuth?: McpAuth;
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
  const services = createDomainServices({
    db,
    embedding,
    env,
    llm,
    vectorStore,
  });
  return { db, embedding, env, llm, services, vectorStore };
}

/**
 * Cloudflare Workers 環境向けに全依存関係を初期化して DI コンテキストを構築する。
 * Hyperdrive 経由で DB に接続し、Vectorize binding をベクトルストアとして使用する。
 */
export function createContextForWorkers(
  env: Env,
  bindings: {
    hyperdrive: Hyperdrive;
    vectorize?: VectorizeBinding;
    ai?: WorkersAiBinding;
  }
): AppContext["Variables"] {
  const db = createDbForHyperdrive(bindings.hyperdrive);
  const llm =
    env.LLM_PROVIDER === "workers-ai" && bindings.ai
      ? createWorkersAILanguageModel(bindings.ai, env.LLM_MODEL)
      : createLLMProvider(env);
  const embedding =
    env.EMBEDDING_PROVIDER === "workers-ai" && bindings.ai
      ? createWorkersAIEmbeddingModel(bindings.ai, env.EMBEDDING_MODEL)
      : createEmbeddingProvider(env);
  const vectorStore = createVectorStore(env, {
    vectorizeBinding: bindings.vectorize,
  });
  const services = createDomainServices({
    db,
    embedding,
    env,
    llm,
    vectorStore,
  });
  return { db, embedding, env, llm, services, vectorStore };
}

/**
 * Cloudflare Hyperdrive binding の最小型定義。
 */
export interface Hyperdrive {
  connectionString: string;
}
