import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import type { AppContext } from '../context.js';
import { getServices } from '../core/services.js';
import { reindexBodySchema } from '../schemas/index.js';

const vectorRouter = new Hono<AppContext>()
  // POST /api/vector/reindex - インデックス全再構築 (SSE ストリーミング)
  .post('/reindex', zValidator('json', reindexBodySchema), async (c) => {
    const body = c.req.valid('json');
    const reindexService = getServices(c).reindex;

    return streamSSE(c, async (stream) => {
      try {
        const result = await reindexService.reindexAll(body.embeddingConfigId, (progress) => {
          void stream.writeSSE({
            data: JSON.stringify(progress),
            event: 'progress',
          });
        });

        await stream.writeSSE({
          data: JSON.stringify({ done: true, result }),
          event: 'done',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await stream.writeSSE({
          data: JSON.stringify({ error: message }),
          event: 'error',
        });
      }
    });
  });

export default vectorRouter;
