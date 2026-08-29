import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fn } from 'storybook/test';
import type { ReactNode } from 'react';

import { EntityEditorShell } from './-EntityEditorShell.js';
import { ThemeProvider } from '@/context/ThemeContext.js';
import type { LlmInstruction } from '@/lib/types.js';

// useNavigate を解決するため、Story を描画する最小ルーターを構築する。
const rootRoute = createRootRoute();

function makeStoryRoute(Story: () => ReactNode) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: Story,
  });
}

function RouterDecorator(Story: () => ReactNode) {
  const route = makeStoryRoute(Story);
  const router = createRouter({
    routeTree: rootRoute.addChildren([route]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function makeInstruction(overrides: Partial<LlmInstruction> = {}): LlmInstruction {
  return {
    id: 'inst-1',
    novelId: 'novel-1',
    entityType: 'character',
    instruction: '主人公の性格をより魅力的にしてください。',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const meta = {
  component: EntityEditorShell,
  tags: ['autodocs'],
  decorators: [RouterDecorator],
} satisfies Meta<typeof EntityEditorShell>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  novelId: 'novel-1',
  backLabel: '人物一覧へ戻る',
  backTab: 'characters' as const,
  title: 'アリス',
  isEdit: true,
  entityId: 'ent-1',
  onSave: fn(),
  saveLoading: false,
  saveDisabled: false,
  error: null,
  loading: false,
  loadingMessage: '読み込み中...',
  instruction: '',
  onInstructionChange: fn(),
  instructionPlaceholder: 'AIへの指示を入力...',
  onGenerate: fn(),
  generateLoading: false,
  generateDisabled: false,
  generateLabel: 'AIで作成・編集',
  instructions: [
    makeInstruction(),
    makeInstruction({
      id: 'inst-2',
      instruction: '世界観の設定を整理してください。',
    }),
  ],
  onApplyHistory: fn(),
  onRequestDeleteInstruction: fn(),
  deleteInstructionId: null,
  onCloseDeleteInstruction: fn(),
  onConfirmDeleteInstruction: fn(),
  deletingInstruction: false,
  historyOpen: false,
  onOpenHistory: fn(),
  onCloseHistory: fn(),
  entityType: 'character',
  currentContent: '現在の内容',
  historyTitle: '編集履歴',
  onRestoreSuccess: fn(),
  children: (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground-secondary">名前</label>
        <input
          type="text"
          defaultValue="アリス"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground-secondary">説明</label>
        <textarea
          defaultValue="勇敢な少女。"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
      </div>
    </div>
  ),
};

export const Default: Story = {
  args: baseArgs,
};

export const Loading: Story = {
  args: {
    ...baseArgs,
    loading: true,
  },
};

export const WithError: Story = {
  args: {
    ...baseArgs,
    error: '保存に失敗しました。もう一度お試しください。',
  },
};
