import type { Context } from 'hono';
import { stream } from 'hono/streaming';

import type { AppContext } from './context.js';

/**
 * テキストチャンクの AsyncIterable を SSE 形式でストリーミングするレスポンスを返す。
 */
export function sseStream(c: Context<AppContext>, chunks: AsyncIterable<string>): Response {
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  return stream(c, async (s) => {
    for await (const chunk of chunks) {
      await s.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
    await s.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  });
}
