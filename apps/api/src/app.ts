import { cors } from 'hono/cors';
import { Hono } from 'hono';

import type { AppContext } from './context.js';
import { errorHandler } from './middleware/error-handler.js';
import { logger } from './middleware/logger.js';
import backupRouter from './routes/backup.js';
import chaptersRouter from './routes/chapters.js';
import charactersRouter from './routes/characters.js';
import chatRouter from './routes/chat.js';
import contentsRouter from './routes/contents.js';
import historiesRouter from './routes/histories.js';
import llmConfigsRouter from './routes/llm-configs.js';
import llmInstructionsRouter from './routes/llm-instructions.js';
import novelsRouter from './routes/novels.js';
import sectionsRouter from './routes/sections.js';
import settingsRouter from './routes/settings.js';
import timelinesRouter from './routes/timelines.js';
import foreshadowingsRouter from './routes/foreshadowings.js';

// API ルーター定義
export const api = new Hono<AppContext>()
  .route('/novels', novelsRouter)
  .route('/chapters', chaptersRouter)
  .route('/sections', sectionsRouter)
  .route('/contents', contentsRouter)
  .route('/characters', charactersRouter)
  .route('/settings', settingsRouter)
  .route('/timelines', timelinesRouter)
  .route('/foreshadowings', foreshadowingsRouter)
  .route('/llm-instructions', llmInstructionsRouter)
  .route('/llm-configs', llmConfigsRouter)
  .route('/chat', chatRouter)
  .route('/backup', backupRouter)
  .route('/histories', historiesRouter);

// Hono RPC 用のアプリケーション型定義
export type ApiType = typeof api;
export type AppType = ApiType;

/**
 * Hono アプリケーションを構築する。
 * Node.js（index.ts）と Cloudflare Workers（worker.ts）の両方から利用する。
 */
export function createApp(context: AppContext['Variables']) {
  const app = new Hono<AppContext>();

  // ミドルウェア
  app.use(
    '*',
    cors({
      origin: (origin) => origin ?? '*',
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['Content-Type'],
    }),
  );
  app.use('*', logger);
  app.use('*', async (c, next) => {
    c.set('env', context.env);
    c.set('db', context.db);
    c.set('llm', context.llm);
    c.set('embedding', context.embedding);
    c.set('vectorStore', context.vectorStore);
    await next();
  });
  app.onError(errorHandler);

  // ルーター登録
  app.route('/api', api);
  app.get('/health', (c) => c.json({ status: 'ok' as const }));

  return app;
}
