import { parseEnv } from '@novel-creator/shared';

import { createApp } from './app.js';
import { createContextForWorkers } from './context.js';

/**
 * Cloudflare Workers 環境の bindings と環境変数。
 */
export interface WorkerEnv {
  HYPERDRIVE: { connectionString: string };
  VECTORIZE_INDEX: unknown;
  LLM_PROVIDER?: string;
  LLM_API_KEY?: string;
  LLM_MODEL?: string;
  LLM_BASE_URL?: string;
  EMBEDDING_PROVIDER?: string;
  EMBEDDING_API_KEY?: string;
  EMBEDDING_MODEL?: string;
  EMBEDDING_BASE_URL?: string;
  VECTOR_STORE_PROVIDER?: string;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const parsedEnv = parseEnv({
      LLM_PROVIDER: env.LLM_PROVIDER,
      LLM_API_KEY: env.LLM_API_KEY,
      LLM_MODEL: env.LLM_MODEL,
      LLM_BASE_URL: env.LLM_BASE_URL,
      EMBEDDING_PROVIDER: env.EMBEDDING_PROVIDER,
      EMBEDDING_API_KEY: env.EMBEDDING_API_KEY,
      EMBEDDING_MODEL: env.EMBEDDING_MODEL,
      EMBEDDING_BASE_URL: env.EMBEDDING_BASE_URL,
      VECTOR_STORE_PROVIDER: env.VECTOR_STORE_PROVIDER,
    });

    const context = createContextForWorkers(parsedEnv, {
      hyperdrive: env.HYPERDRIVE,
      vectorize: env.VECTORIZE_INDEX,
    });

    const app = createApp(context);
    return app.fetch(request, env, ctx);
  },
};
