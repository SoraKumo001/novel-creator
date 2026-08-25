import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNovels } from '../src/hooks/useNovels.js';
import type { Novel } from '../src/lib/types.js';

// fetch をモック化する。
// useNovels は @/lib/api.js の api クライアント経由で fetch を呼び出す。
const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const sampleNovel: Novel = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'テスト小説',
  description: null,
  createdAt: null,
  updatedAt: null,
};

describe('useNovels', () => {
  it('初期ロードで一覧を取得すること', async () => {
    mockFetch.mockResolvedValue(jsonResponse([sampleNovel]));

    const { result } = renderHook(() => useNovels());

    // 初期状態
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.novels).toHaveLength(1);
    expect(result.current.novels[0].title).toBe('テスト小説');
    expect(result.current.error).toBeNull();
  });

  it('作成（createNovel）で一覧に追加されること', async () => {
    mockFetch.mockResolvedValue(jsonResponse([sampleNovel]));

    const { result } = renderHook(() => useNovels());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const newNovel: Novel = {
      id: '22222222-2222-2222-2222-222222222222',
      title: '新しい小説',
      description: null,
      createdAt: null,
      updatedAt: null,
    };
    mockFetch.mockResolvedValue(jsonResponse(newNovel, 201));

    await act(async () => {
      await result.current.createNovel({ title: '新しい小説' });
    });

    expect(result.current.novels).toHaveLength(2);
    expect(result.current.novels[1].title).toBe('新しい小説');
  });

  it('削除（deleteNovel）で一覧から除外されること', async () => {
    mockFetch.mockResolvedValue(jsonResponse([sampleNovel]));

    const { result } = renderHook(() => useNovels());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockFetch.mockResolvedValue(jsonResponse({ success: true }));

    await act(async () => {
      await result.current.deleteNovel(sampleNovel.id);
    });

    expect(result.current.novels).toHaveLength(0);
  });

  it('API エラー時に error が設定されること', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'サーバーエラー' } }, 500),
    );

    const { result } = renderHook(() => useNovels());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('サーバーエラー');
  });
});
