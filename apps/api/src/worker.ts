import { parseEnvFromBindings } from '@novel-creator/shared/env';

import { createApp } from './app.js';
import { createContextForWorkers } from './context.js';

/**
 * Cloudflare Workers 環境の bindings と環境変数。
 *
 * 文字列バインディングのキー名は env.ts の環境変数名と一致しているため
 * マッピング辞書は不要。オブジェクト型バインディング（HYPERDRIVE / VECTORIZE_INDEX）
 * は parseEnvFromBindings 内で除外される。
 */
export type WorkerEnv = {
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
};

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const parsedEnv = parseEnvFromBindings(env);

    const context = createContextForWorkers(parsedEnv, {
      hyperdrive: env.HYPERDRIVE,
      vectorize: env.VECTORIZE_INDEX,
    });

    const app = createApp(context);
    return app.fetch(request, env, ctx);
  },
};
