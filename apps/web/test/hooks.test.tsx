import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNovels } from "../src/hooks/useNovels.js";
import type { Novel } from "../src/lib/types.js";

// fetch をモック化する。
const mockFetch = vi.fn();

let queryClient: QueryClient;

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

const sampleNovel: Novel = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "テスト小説",
  description: null,
  createdAt: null,
  updatedAt: null,
};

describe("useNovels", () => {
  it("初期ロードで一覧を取得すること", async () => {
    mockFetch.mockResolvedValue(jsonResponse([sampleNovel]));

    const { result } = renderHook(() => useNovels(), {
      wrapper: createWrapper(),
    });

    // 初期状態
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.novels).toHaveLength(1);
    expect(result.current.novels[0].title).toBe("テスト小説");
    expect(result.current.error).toBeNull();
  });

  it("作成（createNovel）で一覧に追加されること", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([sampleNovel]));

    const { result } = renderHook(() => useNovels(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const newNovel: Novel = {
      id: "22222222-2222-2222-2222-222222222222",
      title: "新しい小説",
      description: null,
      createdAt: null,
      updatedAt: null,
    };
    // 1回目: POST (create) のレスポンス
    // 2回目: invalidateQueries で再取得される GET (一覧) のレスポンス
    mockFetch
      .mockResolvedValueOnce(jsonResponse(newNovel, 201))
      .mockResolvedValueOnce(jsonResponse([sampleNovel, newNovel]));

    await act(async () => {
      await result.current.createNovel({ title: "新しい小説" });
    });

    await waitFor(() => expect(result.current.novels).toHaveLength(2));
    expect(result.current.novels[1].title).toBe("新しい小説");
  });

  it("削除（deleteNovel）で一覧から除外されること", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([sampleNovel]));

    const { result } = renderHook(() => useNovels(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // 1回目: DELETE のレスポンス
    // 2回目: invalidateQueries で再取得される GET (一覧) のレスポンス
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse([]));

    await act(async () => {
      await result.current.deleteNovel(sampleNovel.id);
    });

    await waitFor(() => expect(result.current.novels).toHaveLength(0));
  });

  it("API エラー時に error が設定されること", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: "サーバーエラー" }, 500));

    const { result } = renderHook(() => useNovels(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toContain("サーバーエラーが発生しました");
  });
});
