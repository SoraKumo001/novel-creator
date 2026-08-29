import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

import type { AppContext } from '../context.js';
import { getServices } from '../core/services.js';
import {
  chatRequestSchema,
  createChatSessionSchema,
  extractChatEntitiesSchema,
  idParamSchema,
  updateChatSessionSchema,
} from '../schemas/index.js';

const chatRouter = new Hono<AppContext>()
  // POST /api/chat - 創作相談チャットストリーミング（AI SDK UI Message Stream）
  .post('/', zValidator('json', chatRequestSchema), async (c) => {
    const { sessionId, novelId, messages } = c.req.valid('json');
    return getServices(c).chat.streamCreativeChat({ sessionId, novelId, messages });
  })
  // POST /api/chat/extract-entities - チャットテキストから人物・設定を抽出
  .post('/extract-entities', zValidator('json', extractChatEntitiesSchema), async (c) => {
    const { text } = c.req.valid('json');
    const result = await getServices(c).chat.extractEntities(text);
    return c.json(result);
  })
  // GET /api/chat/sessions - セッション一覧取得
  .get('/sessions', async (c) => {
    const novelId = c.req.query('novelId');
    const rows = await getServices(c).chat.listChatSessions(novelId || undefined);
    return c.json(rows);
  })
  // POST /api/chat/sessions - セッション新規作成
  .post('/sessions', zValidator('json', createChatSessionSchema), async (c) => {
    const body = c.req.valid('json');
    const session = await getServices(c).chat.createChatSession({
      novelId: body.novelId || null,
      title: body.title,
    });
    return c.json(session, 201);
  })
  // GET /api/chat/sessions/:id - セッション詳細取得
  .get('/sessions/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const result = await getServices(c).chat.getChatSessionWithMessages(id);
    return c.json({
      ...result.session,
      messages: result.messages,
    });
  })
  // PUT /api/chat/sessions/:id - セッション更新
  .put(
    '/sessions/:id',
    zValidator('param', idParamSchema),
    zValidator('json', updateChatSessionSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const updated = await getServices(c).chat.updateChatSession(id, body);
      return c.json(updated);
    },
  )
  // DELETE /api/chat/sessions/:id - セッション削除
  .delete('/sessions/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    await getServices(c).chat.deleteChatSession(id);
    return c.json({ success: true });
  });

export default chatRouter;
