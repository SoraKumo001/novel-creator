import { cors } from 'hono/cors';
import { Hono } from 'hono';

import type { AppContext } from './context.js';
import { errorHandler } from './middleware/error-handler.js';
import { logger } from './middleware/logger.js';
import backupRouter from './routes/backup.js';
import chaptersRouter from './routes/chapters.js';
import charactersRouter from './routes/characters.js';
import contentsRouter from './routes/contents.js';
import generateRouter from './routes/generate.js';
import llmEditRouter from './routes/llm-edit.js';
import llmInstructionsRouter from './routes/llm-instructions.js';
import novelsRouter from './routes/novels.js';
import sectionsRouter from './routes/sections.js';
import settingsRouter from './routes/settings.js';
import timelinesRouter from './routes/timelines.js';
import chatRouter from './routes/chat.js';

/**
 * Hono アプリケーションを構築する。
 * Node.js（index.ts）と Cloudflare Workers（worker.ts）の両方から利用する。
 */
export function createApp(context: AppContext['Variables']): Hono<AppContext> {
  const app = new Hono<AppContext>();

  // ミドルウェア
  app.use('*', cors());
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
  app.route('/api/novels', novelsRouter);
  app.route('/api', chaptersRouter);
  app.route('/api', sectionsRouter);
  app.route('/api', contentsRouter);
  app.route('/api', charactersRouter);
  app.route('/api', settingsRouter);
  app.route('/api', timelinesRouter);
  app.route('/api', generateRouter);
  app.route('/api', llmEditRouter);
  app.route('/api', llmInstructionsRouter);
  app.route('/api/chat', chatRouter);
  app.route('/api/backup', backupRouter);

  // ヘルスチェック
  app.get('/health', (c) => c.json({ status: 'ok' }));

  return app;
}
