import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  EntityListTab,
  type EntityListTabConfig,
} from '../src/routes/novels/_components/-EntityListTab.js';

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
    description: '勇敢な少女',
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
    emptyDescription: '人物を追加してください',
    idPrefix: 'char',
    cardHeight: 'h-40',
    categoryOf: (e) => e.category,
    onNew: vi.fn(),
    onEdit: vi.fn(),
    renderCardBody: (e) => <p>{e.description}</p>,
    renderMarkdownEditor: () => <div>マークダウンエディタ</div>,
    deleteTitle: '削除しますか？',
    deleteMessage: 'この人物を削除しますか？',
    deleteConfirmLabel: '削除する',
    ...overrides,
  };
}

function renderTab(
  overrides: {
    entities?: TestEntity[];
    loading?: boolean;
    deleting?: boolean;
    config?: EntityListTabConfig<TestEntity>;
    onDelete?: (id: string) => Promise<void>;
  } = {},
) {
  const props = {
    novelId: 'novel-1',
    onRefresh: vi.fn().mockResolvedValue(undefined),
    entities: [makeEntity()],
    loading: false,
    deleting: false,
    onDelete: vi.fn().mockResolvedValue(undefined),
    config: makeConfig(),
    ...overrides,
  };
  render(<EntityListTab {...props} />);
  return props;
}

describe('EntityListTab', () => {
  it('config の renderCardBody 出力が表示されること', () => {
    renderTab();

    expect(screen.getByText('勇敢な少女')).toBeInTheDocument();
    // 名前はサイドバーとカードヘッダーの両方に表示される
    expect(screen.getAllByText('アリス').length).toBeGreaterThan(0);
  });

  it('2 カテゴリのエンティティで 2 つのグループヘッダーが表示されること', () => {
    renderTab({
      entities: [
        makeEntity({ id: 'ent-1', name: 'アリス', category: '主人公' }),
        makeEntity({ id: 'ent-2', name: '魔法王国', category: '世界観' }),
      ],
    });

    // カテゴリ名はサイドバーとグループヘッダーの両方に表示される
    expect(screen.getAllByText('主人公').length).toBeGreaterThan(0);
    expect(screen.getAllByText('世界観').length).toBeGreaterThan(0);
  });

  it('ビュー切替でカード表示とマークダウン編集が切り替わること', () => {
    renderTab();

    // 初期はカード表示
    expect(screen.getByText('勇敢な少女')).toBeInTheDocument();
    expect(screen.queryByText('マークダウンエディタ')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('マークダウン編集'));

    expect(screen.getByText('マークダウンエディタ')).toBeInTheDocument();
    expect(screen.queryByText('勇敢な少女')).not.toBeInTheDocument();
  });

  it('削除フローで ConfirmDialog が表示され、確認で onDelete が id 付きで呼ばれること', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderTab({ onDelete });

    fireEvent.click(screen.getByTitle('削除'));

    expect(screen.getByText('この人物を削除しますか？')).toBeInTheDocument();

    fireEvent.click(screen.getByText('削除する'));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('ent-1'));
  });

  it('entities が空で loading=false のとき空状態が表示されること', () => {
    renderTab({ entities: [] });

    expect(screen.getByText('まだ人物がいません')).toBeInTheDocument();
  });

  it('loading=true のとき loadingMessage が表示されること', () => {
    renderTab({ loading: true });

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('並び順セレクターでカテゴリや名前のソート順が切り替わること', () => {
    renderTab({
      entities: [
        makeEntity({ id: 'ent-1', name: 'ボブ', category: 'Bグループ' }),
        makeEntity({ id: 'ent-2', name: 'アリス', category: 'Aグループ' }),
        makeEntity({ id: 'ent-3', name: 'キャロル', category: 'Aグループ' }),
      ],
    });

    const sortSelect = screen.getByRole('combobox', { name: '並び順' });
    expect(sortSelect).toBeInTheDocument();

    // デフォルト: カテゴリ昇順 (Aグループ -> Bグループ)、名前昇順 (アリス -> キャロル)
    let headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual([
      'Aグループ',
      'アリス',
      'キャロル',
      'Bグループ',
      'ボブ',
    ]);

    // カテゴリ降順・名前降順に変更
    fireEvent.change(sortSelect, { target: { value: 'category-desc-name-desc' } });

    // カテゴリ降順 (Bグループ -> Aグループ)、名前降順 (キャロル -> アリス)
    headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual([
      'Bグループ',
      'ボブ',
      'Aグループ',
      'キャロル',
      'アリス',
    ]);

    expect(sortSelect).toHaveValue('category-desc-name-desc');
  });
});
