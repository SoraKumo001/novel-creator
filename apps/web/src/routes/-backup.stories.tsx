import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { ToastProvider } from "@/components/Toast.js";
import { BackupPage } from "./backup.js";

// ストーリー専用の QueryClient（再試行無効・長時間キャッシュ）
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        refetchOnMount: false,
      },
      mutations: { retry: false },
    },
  });
}

// バックアップ・リストアの API レスポンスをモック
const MOCK_NOVELS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    title: "サンプル小説",
    description: "サンプルの説明",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    title: "二作目の小説",
    description: null,
    createdAt: "2024-02-01T00:00:00.000Z",
    updatedAt: "2024-02-01T00:00:00.000Z",
  },
];

const MOCK_BACKUP = {
  meta: {
    version: 1,
    novelId: "11111111-1111-1111-1111-111111111111",
    novelTitle: "サンプル小説",
    exportedAt: "2024-08-26T00:00:00.000Z",
  },
  rdb: {
    novel: MOCK_NOVELS[0],
    chapters: [
      {
        id: "c1",
        novelId: "11111111-1111-1111-1111-111111111111",
        title: "第1章",
        order: 1,
        summary: "導入",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ],
    sections: [],
    contents: [],
    characters: [
      {
        id: "ch1",
        novelId: "11111111-1111-1111-1111-111111111111",
        category: "主人公",
        name: "アリス",
        description: "主人公",
        traits: [],
        relationships: {},
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ],
    settings: [],
    timelines: [],
    llmInstructions: [],
    chatSessions: [],
    chatMessages: [],
  },
};

function installFetchMock() {
  const original = globalThis.fetch;
  const handler = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.startsWith("/api/novels")) {
      return new Response(JSON.stringify(MOCK_NOVELS), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.startsWith("/api/backup/export")) {
      return new Response(JSON.stringify(MOCK_BACKUP), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "/api/backup/import" && init?.body) {
      const result = {
        success: true,
        novelId: "11111111-1111-1111-1111-111111111111",
        counts: { chapters: 1, characters: 1 },
      };
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
    });
  };

  globalThis.fetch = handler as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const meta = {
  component: BackupPage,
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      const queryClient = makeQueryClient();
      const restore = installFetchMock();
      useEffect(() => restore, []);
      return (
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <Story />
          </ToastProvider>
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof BackupPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
