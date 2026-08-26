import { createConnectRouter } from '@connectrpc/connect';
import type { Context, MiddlewareHandler } from 'hono';

import type { AppContext } from './context.js';
import { registerBackupService } from './services/backup.js';
import { registerChapterService } from './services/chapter.js';
import { registerCharacterService } from './services/character.js';
import { registerChatService } from './services/chat.js';
import { registerContentService } from './services/content.js';
import { registerGenerateService } from './services/generate.js';
import { registerLlmInstructionService } from './services/llm-instruction.js';
import { registerNovelService } from './services/novel.js';
import { registerSectionService } from './services/section.js';
import { registerSettingService } from './services/setting.js';
import { registerTimelineService } from './services/timeline.js';

export function createRpcRouter(getContext: () => AppContext['Variables']) {
  const router = createConnectRouter();
  registerNovelService(router, getContext);
  registerChapterService(router, getContext);
  registerSectionService(router, getContext);
  registerContentService(router, getContext);
  registerCharacterService(router, getContext);
  registerSettingService(router, getContext);
  registerTimelineService(router, getContext);
  registerLlmInstructionService(router, getContext);
  registerGenerateService(router, getContext);
  registerChatService(router, getContext);
  registerBackupService(router, getContext);
  return router;
}

export function createConnectMiddleware(
  getContext: (c: Context<AppContext>) => AppContext['Variables'],
): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    const url = new URL(c.req.url);
    let pathname = url.pathname;
    if (pathname.startsWith('/api/novelcreator.v1.')) {
      pathname = pathname.slice(4);
    }
    // Connect / gRPC パス形式: /novelcreator.v1.<ServiceName>/<MethodName>
    if (!pathname.startsWith('/novelcreator.v1.')) {
      return next();
    }

    const router = createRpcRouter(() => getContext(c));
    const matchingHandler = router.handlers.find((h) => h.requestPath === pathname);

    if (!matchingHandler) {
      return next();
    }

    // Web Request を UniversalServerRequest 相当のオブジェクトに変換
    const rawReq = c.req.raw;
    let reqBody: AsyncIterable<Uint8Array> | Uint8Array | undefined;
    if (rawReq.body) {
      reqBody = (async function* () {
        const reader = rawReq.body!.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) yield value;
          }
        } finally {
          reader.releaseLock();
        }
      })();
    }

    const uReq = {
      url: c.req.url,
      method: c.req.method,
      header: c.req.raw.headers,
      body: reqBody,
      signal: c.req.raw.signal,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uRes = await matchingHandler(uReq as any);

    // レスポンスヘッダーの生成
    const responseHeaders = new Headers();
    if (uRes.header) {
      uRes.header.forEach((val: string, key: string) => {
        responseHeaders.set(key, val);
      });
    }

    let resBody: ReadableStream<Uint8Array> | Uint8Array | null = null;
    if (uRes.body) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (uRes.body as any)[Symbol.asyncIterator] === 'function') {
        const iterator = (uRes.body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator]();
        resBody = new ReadableStream<Uint8Array>({
          async pull(controller) {
            const { done, value } = await iterator.next();
            if (done) {
              controller.close();
            } else {
              controller.enqueue(value);
            }
          },
        });
      } else {
        resBody = uRes.body as unknown as Uint8Array;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Response(resBody as any, {
      status: uRes.status,
      headers: responseHeaders,
    });
  };
}
