import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatProvider, useChat } from '../src/context/ChatContext.js';
import { rowToUIMessage } from '../src/hooks/useChatStreaming.js';

const mockFetch = vi.fn();

let queryClient: QueryClient;

function createChatWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ChatProvider>{children}</ChatProvider>
      </QueryClientProvider>
    );
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/** AI SDK UI Message Stream（text パーツのみ）の SSE バイト列を組み立てる */
function uiMessageStreamBody(text: string, textPartId = 't1'): ReadableStream<Uint8Array> {
  const events = [
    { type: 'text-start', id: textPartId },
    { type: 'text-delta', id: textPartId, delta: text },
    { type: 'text-end', id: textPartId },
    { type: 'finish', finishReason: 'stop' },
  ];
  const sse = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sse));
      controller.close();
    },
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockImplementation(async () => {
    return jsonResponse([]);
  });
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
});

describe('ChatContext & useChat', () => {
  it('初期状態で閉じていること、openChat/closeChat/toggleChat で状態が変化すること', () => {
    const { result } = renderHook(() => useChat(), { wrapper: createChatWrapper() });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.messages).toEqual([]);

    act(() => {
      result.current.openChat('novel-123');
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.selectedNovelId).toBe('novel-123');

    act(() => {
      result.current.closeChat();
    });

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggleChat();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('createSession で新しいセッションが作成され一覧に追加されること', async () => {
    const newSession = {
      id: 'sess-123',
      novelId: 'novel-123',
      title: 'プロット相談',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1回目: マウント時の一覧取得（空）
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useChat(), { wrapper: createChatWrapper() });

    await waitFor(() => expect(result.current.loadingSessions).toBe(false));

    // 2回目: POST (create) のレスポンス
    // 3回目: invalidateQueries で再取得される GET (一覧) のレスポンス
    mockFetch
      .mockResolvedValueOnce(jsonResponse(newSession, 201))
      .mockResolvedValueOnce(jsonResponse([newSession]));

    await act(async () => {
      await result.current.createSession('novel-123', 'プロット相談');
    });

    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    expect(result.current.sessions[0].title).toBe('プロット相談');
    expect(result.current.currentSessionId).toBe('sess-123');
  });

  it('startNewChat で currentSessionId と messages がリセットされること', () => {
    const { result } = renderHook(() => useChat(), { wrapper: createChatWrapper() });

    act(() => {
      result.current.startNewChat();
    });

    expect(result.current.currentSessionId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('sendMessage がセッション自動作成後に /api/chat へ sessionId を含めて送信し、応答を messages に反映すること', async () => {
    const createdSession = {
      id: 'sess-abc',
      novelId: 'novel-123',
      title: 'テストの質問',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1: マウント時一覧取得（空）
    // 2: openChat による novelId 変更で sessions クエリキーが変わり再取得（空）
    // 3: 送信時にセッション作成 POST /api/chat/sessions
    // 4: 作成後 refreshSessions → GET 一覧
    // 以降: POST /api/chat（UI Message Stream）
    mockFetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(createdSession, 201))
      .mockResolvedValueOnce(jsonResponse([createdSession]))
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/chat')) {
          return new Response(uiMessageStreamBody('こんにちは、AIです'), {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          });
        }
        // タイトル自動更新 PUT と 一覧 GET はセッション一覧を返す
        if (url.includes('/api/chat/sessions')) {
          return jsonResponse([createdSession]);
        }
        return jsonResponse([]);
      });

    const { result } = renderHook(() => useChat(), { wrapper: createChatWrapper() });

    await waitFor(() => expect(result.current.loadingSessions).toBe(false));

    await act(async () => {
      await result.current.openChat('novel-123');
    });

    await act(async () => {
      await result.current.sendMessage('テストの質問');
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(result.current.messages[0]).toMatchObject({
      role: 'user',
      content: 'テストの質問',
    });
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'こんにちは、AIです',
    });
    expect(result.current.currentSessionId).toBe('sess-abc');

    // /api/chat への送信ボディに sessionId / novelId が含まれることを検証する
    const chatCall = mockFetch.mock.calls.find((c) => String(c[0]).endsWith('/api/chat'));
    expect(chatCall).toBeDefined();
    const body = JSON.parse(String(chatCall![1]?.body));
    expect(body.sessionId).toBe('sess-abc');
    expect(body.novelId).toBe('novel-123');
    expect(Array.isArray(body.messages)).toBe(true);
  });
});

describe('rowToUIMessage', () => {
  it('parts があればそれをそのまま使い、無ければ text パーツを合成すること', () => {
    const withParts = rowToUIMessage({
      id: 'm1',
      role: 'assistant',
      content: '古い内容',
      parts: [{ type: 'text', text: '新しい内容', state: 'done' }],
    });
    expect(withParts.parts).toEqual([{ type: 'text', text: '新しい内容', state: 'done' }]);

    const withoutParts = rowToUIMessage({
      id: 'm2',
      role: 'user',
      content: 'こんにちは',
    });
    expect(withoutParts.role).toBe('user');
    expect(withoutParts.id).toBe('m2');
    expect(withoutParts.parts).toEqual([{ type: 'text', text: 'こんにちは', state: 'done' }]);
  });
});

describe('extractChatEntities', () => {
  it('extractChatEntities が正しくPOSTリクエストを送出してエンティティを返すこと', async () => {
    const { extractChatEntities } = await import('../src/lib/services/chat.js');
    const mockEntities = {
      characters: [
        { name: 'アリス', category: '主人公', description: '勇敢な少女', traits: ['金髪'] },
      ],
      settings: [{ name: '魔法王国', category: '世界観', description: '魔法の国' }],
    };

    mockFetch.mockResolvedValue(jsonResponse(mockEntities));

    const data = await extractChatEntities('アリスと魔法王国');

    expect(data.characters).toHaveLength(1);
    expect(data.characters[0].name).toBe('アリス');
    expect(data.settings).toHaveLength(1);
    expect(data.settings[0].name).toBe('魔法王国');
  });
});
