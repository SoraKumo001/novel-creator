import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chatMessages, chatSessions, novels } from '@novel-creator/db';
import { streamTextResult } from '@novel-creator/llm';

import type { AppContext } from '../src/context.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import chatRouter from '../src/routes/chat.js';

// @novel-creator/llm の streamTextResult と generateText をモック
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
    streamTextResult: vi.fn(),
  };
});

const mockStreamTextResult = vi.mocked(streamTextResult);

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

/**
 * テキストを stream する偽の StreamTextResult を構築する。
 * toUIMessageStream が消費できる TextStreamPart の ReadableStream を返す。
 */
function createFakeStreamResult(text: string) {
  const id = 'text-1';
  const parts = [
    { type: 'start' },
    { type: 'text-start', id },
    { type: 'text-delta', id, text },
    { type: 'text-end', id },
    {
      type: 'finish',
      finishReason: 'stop',
      rawFinishReason: 'stop',
      totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    },
  ];
  const stream = new ReadableStream({
    start(controller) {
      for (const p of parts) controller.enqueue(p);
      controller.close();
    },
  });
  return { stream };
}

/**
 * chat.service が使う DB チェーンをテーブル参照で振り分けるモック DB を構築する。
 * insert / update の呼び出しを記録する。
 */
function createMockDb(options: {
  session?: Record<string, unknown> | null;
  history?: Record<string, unknown>[];
  novel?: Record<string, unknown> | null;
}) {
  const insertCalls: { table: unknown; values: unknown }[] = [];
  const updateCalls: { table: unknown; values: unknown }[] = [];

  const db = {
    insert: vi.fn().mockImplementation((table: unknown) => ({
      values: vi.fn().mockImplementation((values: unknown) => {
        insertCalls.push({ table, values });
        return { returning: vi.fn().mockResolvedValue([]) };
      }),
    })),
    update: vi.fn().mockImplementation((table: unknown) => ({
      set: vi.fn().mockImplementation((values: unknown) => {
        updateCalls.push({ table, values });
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    })),
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: unknown) => {
        if (table === chatSessions) {
          return {
            where: vi.fn().mockResolvedValue(options.session ? [options.session] : []),
          };
        }
        if (table === chatMessages) {
          return {
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(options.history ?? []),
            }),
          };
        }
        if (table === novels) {
          return {
            where: vi.fn().mockResolvedValue(options.novel ? [options.novel] : []),
          };
        }
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    })),
  };

  return { db, insertCalls, updateCalls };
}

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

function userMessage(text: string) {
  return {
    id: 'user-1',
    role: 'user',
    parts: [{ type: 'text', text }],
  };
}

describe('Chat API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/chat - ユーザーメッセージがストリーム前に保存され、完了後に assistant が保存されること', async () => {
    const { db, insertCalls, updateCalls } = createMockDb({
      session: { id: SESSION_ID, novelId: null, title: '相談' },
      history: [],
    });
    mockStreamTextResult.mockResolvedValue(createFakeStreamResult('こんにちは！') as never);

    const app = createTestChatApp(db);

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        messages: [userMessage('世界観のアイデアをください')],
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');

    // ストリームを最後まで消費して onEnd（assistant 保存）を完了させる
    const text = await res.text();
    expect(text).toContain('"type":"text-delta"');
    expect(text).toContain('こんにちは！');

    // ユーザーメッセージが先に保存される
    const userInsert = insertCalls.find((c) => c.table === chatMessages);
    expect(userInsert).toBeDefined();
    const userValues = userInsert!.values as {
      sessionId: string;
      role: string;
      content: string;
      parts: unknown;
    };
    expect(userValues.sessionId).toBe(SESSION_ID);
    expect(userValues.role).toBe('user');
    expect(userValues.content).toBe('世界観のアイデアをください');
    expect(userValues.parts).toEqual([{ type: 'text', text: '世界観のアイデアをください' }]);

    // assistant メッセージが完了後に保存される
    const assistantInsert = insertCalls.filter((c) => c.table === chatMessages)[1];
    expect(assistantInsert).toBeDefined();
    const assistantValues = assistantInsert!.values as {
      role: string;
      content: string;
      parts: unknown;
    };
    expect(assistantValues.role).toBe('assistant');
    expect(assistantValues.content).toBe('こんにちは！');
    expect(assistantValues.parts).toEqual([{ type: 'text', text: 'こんにちは！' }]);

    // updatedAt が更新される
    expect(updateCalls.length).toBeGreaterThan(0);
    const sessionUpdate = updateCalls.find((c) => c.table === chatSessions);
    expect(sessionUpdate).toBeDefined();
  });

  it('POST /api/chat - プロンプトが DB 履歴から構築されること', async () => {
    const { db } = createMockDb({
      session: { id: SESSION_ID, novelId: null, title: '相談' },
      history: [
        { id: 'm1', sessionId: SESSION_ID, role: 'user', content: '前回の質問', parts: null },
        { id: 'm2', sessionId: SESSION_ID, role: 'assistant', content: '前回の回答', parts: null },
        // 今回挿入されたユーザーメッセージ（DB 正史の履歴再取得に含まれる）
        { id: 'm3', sessionId: SESSION_ID, role: 'user', content: '今回の質問', parts: null },
      ],
    });
    mockStreamTextResult.mockResolvedValue(createFakeStreamResult('回答') as never);

    const app = createTestChatApp(db);

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        messages: [userMessage('今回の質問')],
      }),
    });

    expect(res.status).toBe(200);
    await res.text();

    // streamTextResult に渡されたプロンプトが DB 履歴 + 今回のユーザーメッセージから構築される
    const prompt = mockStreamTextResult.mock.calls[0][1];
    expect(prompt).toContain('mock prompt');
    expect(prompt).toContain('ユーザー: 前回の質問');
    expect(prompt).toContain('アシスタント: 前回の回答');
    expect(prompt).toContain('ユーザー: 今回の質問');
  });

  it('system prompt - creativeChatSystemPrompt に提案フォーマットの指針が含まれること', async () => {
    // 実システムプロンプト自体を検証する。vi.mock により静的 import も 'mock prompt' に
    // 置き換わるため、vi.importActual で実物のモジュールを取得して呼び出す。
    const actual = await vi.importActual<typeof import('@novel-creator/llm')>('@novel-creator/llm');
    const systemPrompt = actual.creativeChatSystemPrompt({
      novel: { title: 'テスト小説' },
    });

    // extract-entities / 📥 設定・人物へ取り込む フローに備えた提案フォーマットの指針が含まれること
    expect(systemPrompt).toContain('提案のフォーマット');
    expect(systemPrompt).toContain('【名前】');
    expect(systemPrompt).toContain('【役割/身分】');
    expect(systemPrompt).toContain('【分類】');
    expect(systemPrompt).toContain('【名称】');
    expect(systemPrompt).toContain('【概要】');
  });

  it('POST /api/chat - 未知の sessionId で 404 になること', async () => {
    const { db } = createMockDb({ session: null, history: [] });

    const app = createTestChatApp(db);

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        messages: [userMessage('質問')],
      }),
    });

    expect(res.status).toBe(404);
    expect(mockStreamTextResult).not.toHaveBeenCalled();
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

  it('POST /api/chat - sessionId が uuid でない場合 400 エラーになること', async () => {
    const app = createTestChatApp({});

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'not-a-uuid',
        messages: [userMessage('質問')],
      }),
    });

    expect(res.status).toBe(400);
  });

  it('POST /api/chat - novelId がある場合に読み取りツール群が streamTextResult に渡されること', async () => {
    const novelId = '22222222-2222-4222-8222-222222222222';
    const { db } = createMockDb({
      session: { id: SESSION_ID, novelId, title: '相談' },
      novel: { id: novelId, title: 'テスト小説', description: null },
      history: [],
    });
    mockStreamTextResult.mockResolvedValue(createFakeStreamResult('回答') as never);

    const app = createTestChatApp(db);

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        novelId,
        messages: [userMessage('主人公について教えて')],
      }),
    });

    expect(res.status).toBe(200);
    await res.text();

    // 第 3 引数に tools / stopWhen が渡されていること
    expect(mockStreamTextResult).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({
        tools: expect.anything(),
        stopWhen: expect.anything(),
      }),
    );

    const options = mockStreamTextResult.mock.calls[0][2] as {
      tools: Record<string, unknown>;
      stopWhen: unknown;
    };
    // 読み取りツールおよび設定提案ツールが登録されていること
    expect(Object.keys(options.tools).sort()).toEqual([
      'getCharacters',
      'getForeshadowings',
      'getNovelInfo',
      'getPlotAndChapters',
      'getSectionContent',
      'getSettings',
      'getTimelines',
      'proposeAddForeshadowing',
      'proposeAddTimelineEvent',
      'proposeCreateCharacter',
      'proposeCreateSetting',
      'proposeUpdatePlot',
      'searchNovelKnowledge',
    ]);
  });

  it('POST /api/chat - novelId がない場合に tools が渡されないこと', async () => {
    const { db } = createMockDb({
      session: { id: SESSION_ID, novelId: null, title: '相談' },
      history: [],
    });
    mockStreamTextResult.mockResolvedValue(createFakeStreamResult('回答') as never);

    const app = createTestChatApp(db);

    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        messages: [userMessage('世界観のアイデアをください')],
      }),
    });

    expect(res.status).toBe(200);
    await res.text();

    const options = mockStreamTextResult.mock.calls[0][2] as {
      tools?: unknown;
      stopWhen: unknown;
    };
    expect(options.tools).toBeUndefined();
    expect(options.stopWhen).toBeDefined();
  });

  it('POST /api/chat/sessions - 新規セッションが作成できること', async () => {
    const sampleSession = {
      id: SESSION_ID,
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
        id: SESSION_ID,
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

  describe('formatErrorMessage & classifyError', () => {
    it('APICallError 429 の場合にレート制限メッセージと詳細を返すこと', async () => {
      const { APICallError } = await import('ai');
      const { formatErrorMessage, classifyError } =
        await import('../src/middleware/error-handler.js');
      const apiErr = new APICallError({
        message: 'Rate limit exceeded: 15 requests per minute',
        statusCode: 429,
        url: 'https://api.example.com',
        requestBodyValues: {},
      });

      const classified = classifyError(apiErr);
      expect(classified.code).toBe('RATE_LIMITED');
      expect(classified.status).toBe(429);

      const formatted = formatErrorMessage(apiErr);
      expect(formatted).toContain('レート制限');
      expect(formatted).toContain('Rate limit exceeded');
    });

    it('APICallError 401 の場合に認証エラーメッセージと詳細を返すこと', async () => {
      const { APICallError } = await import('ai');
      const { formatErrorMessage, classifyError } =
        await import('../src/middleware/error-handler.js');
      const apiErr = new APICallError({
        message: 'Invalid API key provided',
        statusCode: 401,
        url: 'https://api.example.com',
        requestBodyValues: {},
      });

      const classified = classifyError(apiErr);
      expect(classified.code).toBe('LLM_AUTH_ERROR');
      expect(classified.status).toBe(502);

      const formatted = formatErrorMessage(apiErr);
      expect(formatted).toContain('認証に失敗しました');
      expect(formatted).toContain('Invalid API key');
    });

    it('一般の Error の場合にエラーメッセージを返すこと', async () => {
      const { formatErrorMessage } = await import('../src/middleware/error-handler.js');
      const err = new Error('Database connection timed out');
      const formatted = formatErrorMessage(err);
      expect(formatted).toBe('Database connection timed out');
    });
  });
});
