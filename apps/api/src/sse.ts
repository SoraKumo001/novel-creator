import type { Context } from 'hono';
import { stream, streamSSE } from 'hono/streaming';

import type { AppContext } from './context.js';
import { formatErrorMessage } from './middleware/error-handler.js';

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

/**
 * SSE イベントを書き込むエミッタ。event 名とペイロードを受け取り、data は JSON 文字列化される。
 */
export type SSEEventEmitter = (event: string, data: unknown) => Promise<void>;

export interface StreamEventsOptions {
  /**
   * 'error' イベントのペイロードを構築する関数。
   * 未指定時は解析系 SSE と同一の { type: 'error', message } 形状を使用する。
   */
  buildErrorPayload?: (message: string) => Record<string, unknown>;
}

/**
 * 任意のイベントソース（AsyncIterable や進捗コールバック形式など）を
 * SSE (text/event-stream) レスポンスとしてストリーミングする汎用ヘルパ。
 *
 * run 内で例外が発生した場合は event: 'error' を書き出して終了する。
 * メッセージには middleware/error-handler.ts の formatErrorMessage による分類を適用する
 * （汎用 Error の場合は従来どおり err.message がそのまま使われるため、後方互換を維持する）。
 */
export function streamEvents(
  c: Context<AppContext>,
  run: (emit: SSEEventEmitter) => Promise<void>,
  opts: StreamEventsOptions = {},
): Response {
  const buildErrorPayload =
    opts.buildErrorPayload ?? ((message: string) => ({ type: 'error', message }));
  return streamSSE(c, async (stream) => {
    const emit: SSEEventEmitter = async (event, data) => {
      await stream.writeSSE({ event, data: JSON.stringify(data) });
    };
    try {
      await run(emit);
    } catch (err) {
      await emit('error', buildErrorPayload(formatErrorMessage(err)));
    }
  });
}
