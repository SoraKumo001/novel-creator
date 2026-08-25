import { config } from 'dotenv';
import { serve } from '@hono/node-server';

import { parseEnv } from '@novel-creator/shared';

import { createApp } from './app.js';
import { createContext } from './context.js';

// ワークスペースルートの .env を明示的に読み込む
config({ path: '../../.env' });

const env = parseEnv();
console.log('[api] env loaded:', {
  LLM_PROVIDER: env.LLM_PROVIDER,
  LLM_MODEL: env.LLM_MODEL,
  EMBEDDING_PROVIDER: env.EMBEDDING_PROVIDER,
  EMBEDDING_MODEL: env.EMBEDDING_MODEL,
  EMBEDDING_API_KEY_SET: !!env.EMBEDDING_API_KEY,
});
const context = createContext(env);

const app = createApp(context);

const port = 3000;
console.log(`[api] Starting server on http://localhost:${port}`);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[api] Listening on http://localhost:${info.port}`);
});
