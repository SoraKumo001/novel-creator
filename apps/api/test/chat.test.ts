import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../src/context.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import chatRouter from '../src/routes/chat.js';

// @novel-creator/llm の streamText と generateText をモック
vi.mock('@novel-creator/llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@novel-creator/llm')>();
  return {
    ...actual,
    creativeChatSystemPrompt: vi.fn().mockReturnValue('mock prompt'),
    generateText: vi.fn().mockResolvedValue(
      JSON.stringify({
        characters: [
          {
            name: 'アリス',
            category: '主人公',
            description: '勇敢な少女',
            traits: ['金髪', '剣術'],
          },
        ],
        settings: [{ name: '魔法王国', category: '世界観', description: '魔法が発達した国' }],
      }),
    ),
    streamText: vi.fn().mockImplementation(async function* () {
      yield 'こんにちは！';
      yield '設定の相談ですね。';
    }),
  };
});

function createTestChatApp(mockDb: unknown) {
  const app = new Hono<AppContext>();
  app.use('*', async (c, next) => {
    c.set('env', {} as never);
    c.set('db', mockDb as never);
    c.set('llm', {} as never);
    c.set('embedding', {} as never);
    c.set('vectorStore', {} as never);
    await next();
  });
  app.onError(errorHandler);
  app.route('/api/chat', chatRouter);
  return app;
}

describe('Chat API', () => {
  it('POST /api/chat - 小説指定なしでストリーミングレスポンスが返ること', async () => {
    const app = createTestChatApp({});

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: '世界観のアイデアをください' }],
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const text = await res.text();
    expect(text).toContain('こんにちは！');
    expect(text).toContain('設定の相談ですね。');
    expect(text).toContain('"done":true');
  });

  it('POST /api/chat - 不正なリクエストボディで 400 エラーになること', async () => {
    const app = createTestChatApp({});

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [],
      }),
    });

    expect(res.status).toBe(400);
  });

  it('POST /api/chat/sessions - 新規セッションが作成できること', async () => {
    const sampleSession = {
      id: '11111111-1111-1111-1111-111111111111',
      novelId: null,
      title: '世界観の相談',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([sampleSession]),
        }),
      }),
    };

    const app = createTestChatApp(mockDb);

    const res = await app.request('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '世界観の相談',
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as typeof sampleSession;
    expect(data.title).toBe('世界観の相談');
  });

  it('GET /api/chat/sessions - セッション一覧が取得できること', async () => {
    const sampleSessions = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        novelId: null,
        title: '相談1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(sampleSessions),
          }),
        }),
      }),
    };

    const app = createTestChatApp(mockDb);

    const res = await app.request('/api/chat/sessions');
    expect(res.status).toBe(200);
    const data = (await res.json()) as typeof sampleSessions;
    expect(data).toHaveLength(1);
  });

  it('POST /api/chat/extract-entities - テキストから人物・設定が抽出されること', async () => {
    const app = createTestChatApp({});

    const res = await app.request('/api/chat/extract-entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '主人公アリスと魔法王国の提案',
      }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      characters: { name: string; category: string; description: string; traits: string[] }[];
      settings: { name: string; category: string; description: string }[];
    };
    expect(data.characters).toHaveLength(1);
    expect(data.characters[0].name).toBe('アリス');
    expect(data.settings).toHaveLength(1);
    expect(data.settings[0].name).toBe('魔法王国');
  });
});
