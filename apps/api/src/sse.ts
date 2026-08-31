import type { Context } from 'hono';
import { stream } from 'hono/streaming';

import type { AppContext } from './context.js';

export type SSEChunk = string | { text: string; variant?: number };

/**
 * テキストチャンクまたはバリエーション付きチャンクの AsyncIterable を SSE 形式でストリーミングするレスポンスを返す。
 */
export function sseStream(c: Context<AppContext>, chunks: AsyncIterable<SSEChunk>): Response {
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  return stream(c, async (s) => {
    for await (const chunk of chunks) {
      if (typeof chunk === 'string') {
        await s.write(`data: ${JSON.stringify({ text: chunk, variant: 0 })}\n\n`);
      } else {
        await s.write(
          `data: ${JSON.stringify({ text: chunk.text, variant: chunk.variant ?? 0 })}\n\n`,
        );
      }
    }
    await s.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  });
}
