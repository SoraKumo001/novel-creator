import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as vectorService from "../src/lib/services/vector.js";
import { BackupPage } from "../src/routes/backup.lazy.js";

const mockToast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/hooks/useToast.js", () => ({
  useToast: () => mockToast,
}));

// streamReindex は lib/services/vector.ts モジュール境界でモックする
vi.mock("../src/lib/services/vector.js", () => ({
  streamReindex: vi.fn(),
}));

const streamReindexMock = vi.mocked(vectorService.streamReindex);

const NOVEL_ID = "11111111-1111-4111-8111-111111111111";
const DEFAULT_EMBEDDING_CONFIG_ID = "22222222-2222-4222-8222-222222222222";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  return input instanceof URL ? input.href : input.url;
}

const mockFetch = vi.fn();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function renderPage() {
  return render(<BackupPage />, { wrapper: createWrapper() });
}

/** バックアップファイルを選択し、確認ダイアログからリストアを完了させる */
async function performRestore() {
  const backupData = {
    meta: {
      exportedAt: "2026-01-01T00:00:00.000Z",
      novelId: NOVEL_ID,
      novelTitle: "テスト小説",
      version: 1,
    },
    rdb: {
      chapters: [],
      characters: [],
      contents: [],
      novel: { id: NOVEL_ID, title: "テスト小説" },
      sections: [],
      settings: [],
      timelines: [],
    },
  };
  const file = new File([JSON.stringify(backupData)], "backup.json", {
    type: "application/json",
  });
  fireEvent.change(screen.getByLabelText(/バックアップファイル/), {
    target: { files: [file] },
  });

  await waitFor(() => {
    expect(
      screen.getByText("バックアップ内容のプレビュー")
    ).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: /リストア/ }));
  fireEvent.click(screen.getByRole("button", { name: "上書きして復元" }));

  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: /ベクトルデータを再生成する/ })
    ).toBeInTheDocument();
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockImplementation((input: RequestInfo | URL) => {
    const url = urlOf(input);
    if (url.includes("/api/novels")) {
      return Promise.resolve(
        jsonResponse([
          {
            id: NOVEL_ID,
            title: "テスト小説",
            description: null,
            createdAt: null,
            updatedAt: null,
          },
        ])
      );
    }
    if (url.includes("/api/embedding-configs")) {
      return Promise.resolve(
        jsonResponse([
          {
            id: DEFAULT_EMBEDDING_CONFIG_ID,
            name: "テスト埋め込みモデル",
            provider: "openai",
            modelId: "text-embedding-3-small",
            dimensions: 1536,
            isDefault: true,
            description: null,
            baseUrl: null,
            apiKeyMasked: null,
            hasApiKey: false,
            createdAt: null,
            updatedAt: null,
          },
        ])
      );
    }
    if (url.includes("/api/backup/import")) {
      return Promise.resolve(
        jsonResponse({ success: true, novelId: NOVEL_ID, counts: {} })
      );
    }
    return Promise.resolve(jsonResponse({}));
  });

  streamReindexMock.mockReset();
  streamReindexMock.mockResolvedValue(undefined);
  mockToast.success.mockClear();
  mockToast.error.mockClear();
});

describe("BackupPage", () => {
  it("リストア完了からベクトルデータ再構築の一連のフローが正常に動作すること", async () => {
    let finishReindex: (() => void) | undefined;
    streamReindexMock.mockImplementation(
      (options) =>
        new Promise<void>((resolve) => {
          finishReindex = () => {
            options.onDone();
            resolve();
          };
        })
    );

    renderPage();

    // 1. リストア前でも再生成ボタンが表示される
    const reindexButton = screen.getByRole("button", {
      name: /ベクトルデータを再生成する/,
    });
    expect(reindexButton).toBeInTheDocument();

    // 2. リストア実行
    await performRestore();
    expect(mockToast.success).toHaveBeenCalledWith(
      "リストアが完了しました。ベクトルデータの再生成をお忘れなく"
    );

    // 3. モーダルを開いて再構築を開始
    fireEvent.click(reindexButton);
    expect(
      screen.getByText("⚡ ベクトルインデックス全再構築")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "再構築を開始" }));

    await waitFor(() => {
      expect(streamReindexMock).toHaveBeenCalledTimes(1);
    });
    expect(streamReindexMock).toHaveBeenCalledWith(
      expect.objectContaining({
        embeddingConfigId: DEFAULT_EMBEDDING_CONFIG_ID,
        onProgress: expect.any(Function),
        onDone: expect.any(Function),
        onError: expect.any(Function),
      })
    );

    // 4. 再構築中はボタンが無効化される
    await waitFor(() => {
      expect(reindexButton).toBeDisabled();
    });

    // 5. 再構築完了でボタンが再有効化される
    await act(async () => {
      finishReindex?.();
    });
    await waitFor(() => {
      expect(reindexButton).toBeEnabled();
    });
  });
});
