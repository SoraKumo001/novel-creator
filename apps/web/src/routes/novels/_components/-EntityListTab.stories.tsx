import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { EntityListTab, type EntityListTabConfig } from './-EntityListTab.js';

interface TestEntity {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

function makeEntity(overrides: Partial<TestEntity>): TestEntity {
  return {
    id: 'ent-1',
    name: 'アリス',
    category: '主人公',
    description: '勇敢な少女。好奇心旺盛で行動力がある。',
    ...overrides,
  };
}

function makeConfig(
  overrides: Partial<EntityListTabConfig<TestEntity>> = {},
): EntityListTabConfig<TestEntity> {
  return {
    title: '人物一覧',
    newLabel: '新規作成',
    sidebarLabel: 'カテゴリ',
    sidebarEmpty: 'カテゴリはありません',
    loadingMessage: '読み込み中...',
    emptyTitle: 'まだ人物がいません',
    emptyDescription: '「新規作成」から人物を追加してください。',
    idPrefix: 'char',
    cardHeight: 'h-40',
    categoryOf: (e) => e.category,
    onNew: fn(),
    onEdit: fn(),
    renderCardBody: (e) => <p>{e.description}</p>,
    renderMarkdownEditor: () => (
      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
        マークダウンエディタ（プレビュー）
      </div>
    ),
    deleteTitle: '削除しますか？',
    deleteMessage: 'この人物を削除しますか？',
    deleteConfirmLabel: '削除する',
    ...overrides,
  };
}

const meta = {
  component: EntityListTab,
  tags: ['autodocs'],
} satisfies Meta<typeof EntityListTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    novelId: 'novel-1',
    onRefresh: fn().mockResolvedValue(undefined),
    entities: [
      makeEntity({ id: 'ent-1', name: 'アリス', category: '主人公' }),
      makeEntity({ id: 'ent-2', name: 'ボブ', category: '主人公' }),
      makeEntity({ id: 'ent-3', name: '魔法王国', category: '世界観' }),
      makeEntity({ id: 'ent-4', name: '竜の谷', category: '世界観' }),
    ],
    loading: false,
    deleting: false,
    onDelete: fn().mockResolvedValue(undefined),
    config: makeConfig(),
  },
};

export const Empty: Story = {
  args: {
    novelId: 'novel-1',
    onRefresh: fn().mockResolvedValue(undefined),
    entities: [],
    loading: false,
    deleting: false,
    onDelete: fn().mockResolvedValue(undefined),
    config: makeConfig(),
  },
};

export const Loading: Story = {
  args: {
    novelId: 'novel-1',
    onRefresh: fn().mockResolvedValue(undefined),
    entities: [],
    loading: true,
    deleting: false,
    onDelete: fn().mockResolvedValue(undefined),
    config: makeConfig(),
  },
};
