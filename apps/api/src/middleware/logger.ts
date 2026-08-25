import type { Context, Next } from 'hono';

import type { AppContext } from '../context.js';

/**
 * リクエストログミドルウェア。
 * メソッド、パス、ステータス、所要時間を記録する。
 */
export async function logger(c: Context<AppContext>, next: Next): Promise<void> {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  const status = c.res.status;
  console.log(`[api] ${c.req.method} ${c.req.path} -> ${status} (${duration}ms)`);
}
