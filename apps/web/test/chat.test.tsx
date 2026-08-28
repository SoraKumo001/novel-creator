import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatProvider, useChat } from '../src/context/ChatContext.js';
import { streamChat } from '../src/lib/chatApi.js';

const mockFetch = vi.fn();

function createChatWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ChatProvider>{children}</ChatProvider>;
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

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockImplementation(async () => {
    return jsonResponse([]);
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

    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      if (urlStr.includes('/chat/sessions') && method === 'POST') {
        return jsonResponse(newSession, 201);
      }
      return jsonResponse([]);
    });

    const { result } = renderHook(() => useChat(), { wrapper: createChatWrapper() });

    await act(async () => {
      await result.current.createSession('novel-123', 'プロット相談');
    });

    expect(result.current.sessions).toHaveLength(1);
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
});

describe('streamChat', () => {
  it('SSEチャンクを正しくパースしてコールバックを実行すること', async () => {
    const sseData = [
      'data: {"text":"こんにちは"}\n\n',
      'data: {"text":"、AIです"}\n\n',
      'data: {"done":true}\n\n',
    ].join('');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseData));
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Content-Type': 'text/event-stream' }),
      body: stream,
    });

    const chunks: string[] = [];
    await streamChat({
      sessionId: 'sess-123',
      novelId: 'novel-123',
      messages: [{ role: 'user', content: 'テスト' }],
      onChunk: (chunk) => chunks.push(chunk),
    });

    expect(chunks).toEqual(['こんにちは', '、AIです']);
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
