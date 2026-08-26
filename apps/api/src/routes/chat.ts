import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import type { StreamingApi } from 'hono/utils/stream';
import { zValidator } from '@hono/zod-validator';
import { creativeChatSystemPrompt, streamText } from '@novel-creator/llm';

import type { AppContext } from '../context.js';
import { ChatDomainService, NotFoundError, NovelDomainService } from '../core/index.js';
import { searchContext } from '../rag.js';
import {
  chatRequestSchema,
  createChatSessionSchema,
  extractChatEntitiesSchema,
  idParamSchema,
  updateChatSessionSchema,
} from '../schemas/index.js';

const chatRouter = new Hono<AppContext>();

// POST /api/chat - 創作相談チャットストリーミング
chatRouter.post('/', zValidator('json', chatRequestSchema), async (c) => {
  const { novelId, messages } = c.req.valid('json');

  let contextSettings: string[] = [];
  let contextCharacters: string[] = [];
  let novelInfo: { title: string; description?: string | null } | undefined;

  if (novelId) {
    try {
      const novelService = new NovelDomainService({
        db: c.var.db,
        llm: c.var.llm,
        embedding: c.var.embedding,
        vectorStore: c.var.vectorStore,
        env: c.var.env,
      });
      const novelDetail = await novelService.getNovelDetail(novelId);
      novelInfo = {
        title: novelDetail.novel.title,
        description: novelDetail.novel.description,
      };

      const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
      if (lastUserMessage) {
        const ragContext = await searchContext(
          c.var.vectorStore,
          c.var.embedding,
          novelId,
          { query: lastUserMessage.content },
          c.var.env,
        );
        contextSettings = ragContext.settings;
        contextCharacters = ragContext.characters;
      }
    } catch {
      // RAG 検索・小説取得失敗時は空コンテキストで継続
    }
  }

  const systemPrompt = creativeChatSystemPrompt({
    novel: novelInfo,
    settings: contextSettings,
    characters: contextCharacters,
  });

  const prompt = [
    systemPrompt,
    ...messages.map((m) => `${m.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${m.content}`),
  ].join('\n\n');

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  return stream(c, async (s: StreamingApi) => {
    for await (const chunk of streamText(c.var.llm, prompt)) {
      await s.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
    await s.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  });
});

// POST /api/chat/extract-entities - チャットテキストから人物・設定を抽出
chatRouter.post('/extract-entities', zValidator('json', extractChatEntitiesSchema), async (c) => {
  const service = new ChatDomainService({
    db: c.var.db,
    llm: c.var.llm,
    embedding: c.var.embedding,
    vectorStore: c.var.vectorStore,
    env: c.var.env,
  });
  const { text } = c.req.valid('json');
  const result = await service.extractEntities(text);
  return c.json(result);
});

// GET /api/chat/sessions - セッション一覧取得
chatRouter.get('/sessions', async (c) => {
  const service = new ChatDomainService({
    db: c.var.db,
    llm: c.var.llm,
    embedding: c.var.embedding,
    vectorStore: c.var.vectorStore,
    env: c.var.env,
  });
  const novelId = c.req.query('novelId');
  const rows = await service.listChatSessions(novelId || undefined);
  return c.json(rows);
});

// POST /api/chat/sessions - セッション新規作成
chatRouter.post('/sessions', zValidator('json', createChatSessionSchema), async (c) => {
  const service = new ChatDomainService({
    db: c.var.db,
    llm: c.var.llm,
    embedding: c.var.embedding,
    vectorStore: c.var.vectorStore,
    env: c.var.env,
  });
  const body = c.req.valid('json');
  const session = await service.createChatSession({
    novelId: body.novelId || null,
    title: body.title,
  });
  return c.json(session, 201);
});

// GET /api/chat/sessions/:id - セッション詳細取得
chatRouter.get('/sessions/:id', zValidator('param', idParamSchema), async (c) => {
  const service = new ChatDomainService({
    db: c.var.db,
    llm: c.var.llm,
    embedding: c.var.embedding,
    vectorStore: c.var.vectorStore,
    env: c.var.env,
  });
  const { id } = c.req.valid('param');
  try {
    const result = await service.getChatSessionWithMessages(id);
    return c.json({
      ...result.session,
      messages: result.messages,
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ error: 'Chat session not found' }, 404);
    }
    throw err;
  }
});

// PUT /api/chat/sessions/:id - セッション更新
chatRouter.put(
  '/sessions/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateChatSessionSchema),
  async (c) => {
    const service = new ChatDomainService({
      db: c.var.db,
      llm: c.var.llm,
      embedding: c.var.embedding,
      vectorStore: c.var.vectorStore,
      env: c.var.env,
    });
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    try {
      const updated = await service.updateChatSession(id, body);
      return c.json(updated);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return c.json({ error: 'Chat session not found' }, 404);
      }
      throw err;
    }
  },
);

// DELETE /api/chat/sessions/:id - セッション削除
chatRouter.delete('/sessions/:id', zValidator('param', idParamSchema), async (c) => {
  const service = new ChatDomainService({
    db: c.var.db,
    llm: c.var.llm,
    embedding: c.var.embedding,
    vectorStore: c.var.vectorStore,
    env: c.var.env,
  });
  const { id } = c.req.valid('param');
  try {
    await service.deleteChatSession(id);
    return c.json({ success: true });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ error: 'Chat session not found' }, 404);
    }
    throw err;
  }
});

export default chatRouter;
