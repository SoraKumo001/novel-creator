import { parseEnvFromBindings } from "@novel-creator/shared/env";

import type { VectorizeBinding } from "@novel-creator/vector";

import { createApp } from "./app.js";
import { createContextForWorkers } from "./context.js";

/**
 * Cloudflare Workers 環境の bindings と環境変数。
 *
 * 文字列バインディングのキー名は env.ts の環境変数名と一致しているため
 * マッピング辞書は不要。オブジェクト型バインディング（HYPERDRIVE / VECTORIZE_INDEX）
 * は parseEnvFromBindings 内で除外される。
 */
export type WorkerEnv = {
  ASSETS?: Fetcher;
  HYPERDRIVE?: { connectionString: string };
  VECTORIZE_INDEX?: VectorizeBinding;
  DATABASE_URL?: string;
  BETTER_AUTH_URL?: string;
  MASTER_SECRET?: string;
  WEB_ORIGIN?: string;
  LLM_PROVIDER?: string;
  LLM_API_KEY?: string;
  LLM_MODEL?: string;
  LLM_BASE_URL?: string;
  EMBEDDING_PROVIDER?: string;
  EMBEDDING_API_KEY?: string;
  EMBEDDING_MODEL?: string;
  EMBEDDING_BASE_URL?: string;
  VECTOR_STORE_PROVIDER?: string;
};

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    const connectionString =
      env.DATABASE_URL ?? env.HYPERDRIVE?.connectionString;

    const parsedEnv = parseEnvFromBindings({
      ...env,
      DATABASE_URL: connectionString,
    });

    const hyperdrive = env.HYPERDRIVE ?? {
      connectionString: connectionString ?? "",
    };

    const context = createContextForWorkers(parsedEnv, {
      hyperdrive,
      vectorize: env.VECTORIZE_INDEX,
    });

    const app = createApp(context);
    const response = await app.fetch(request, env, ctx);

    // API 以外の 404 は静的アセット (SPA) へフォールバック
    const url = new URL(request.url);
    const isApiRoute =
      url.pathname === "/api" || url.pathname.startsWith("/api/");
    if (response.status === 404 && env.ASSETS && !isApiRoute) {
      return env.ASSETS.fetch(request);
    }

    return response;
  },
};
