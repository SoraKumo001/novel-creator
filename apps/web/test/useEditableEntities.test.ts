import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEditableEntities } from '../src/hooks/useEditableEntities.js';

interface TestItem {
  _id: string;
  _selected: boolean;
  name: string;
  category: string;
}

const initial: TestItem[] = [
  { _id: 'a', _selected: true, name: 'アリス', category: '主人公' },
  { _id: 'b', _selected: false, name: 'ボブ', category: '敵対者' },
];

describe('useEditableEntities', () => {
  beforeEach(() => {
    // addEmptyItem の id 生成（Date.now()）を固定する。
    vi.spyOn(Date, 'now').mockReturnValue(1234567890);
  });

  it('初期状態で items が渡した配列になること', () => {
    const { result } = renderHook(() => useEditableEntities<TestItem>(initial));

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].name).toBe('アリス');
  });

  it('初期値なしで空配列になること', () => {
    const { result } = renderHook(() => useEditableEntities<TestItem>());

    expect(result.current.items).toEqual([]);
  });

  it('toggleItem で _selected が反転すること', () => {
    const { result } = renderHook(() => useEditableEntities<TestItem>(initial));

    act(() => {
      result.current.toggleItem('a');
    });

    expect(result.current.items[0]._selected).toBe(false);
    expect(result.current.items[1]._selected).toBe(false);
  });

  it('toggleItem を往復すると元の状態に戻ること', () => {
    const { result } = renderHook(() => useEditableEntities<TestItem>(initial));

    act(() => {
      result.current.toggleItem('a');
      result.current.toggleItem('a');
    });

    expect(result.current.items[0]._selected).toBe(true);
  });

  it('updateItem でパッチがマージされること', () => {
    const { result } = renderHook(() => useEditableEntities<TestItem>(initial));

    act(() => {
      result.current.updateItem('a', { category: 'ヒロイン' });
    });

    expect(result.current.items[0].category).toBe('ヒロイン');
    expect(result.current.items[0].name).toBe('アリス');
  });

  it('updateItem に関数を渡すと現在の項目からパッチを算出できること', () => {
    const { result } = renderHook(() => useEditableEntities<TestItem>(initial));

    act(() => {
      result.current.updateItem('b', (item) => ({ name: `${item.name}・改` }));
    });

    expect(result.current.items[1].name).toBe('ボブ・改');
  });

  it('updateItem は存在しない id に影響しないこと', () => {
    const { result } = renderHook(() => useEditableEntities<TestItem>(initial));

    act(() => {
      result.current.updateItem('zzz', { category: 'なし' });
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].category).toBe('主人公');
  });

  it('removeItem で指定 id の項目が削除されること', () => {
    const { result } = renderHook(() => useEditableEntities<TestItem>(initial));

    act(() => {
      result.current.removeItem('a');
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]._id).toBe('b');
  });

  it('addEmptyItem で _selected: true と idPrefix 付き id の項目が末尾に追加されること', () => {
    const { result } = renderHook(() => useEditableEntities<TestItem>(initial));

    act(() => {
      result.current.addEmptyItem({ name: '新しい登場人物', category: '未分類' }, 'char-');
    });

    expect(result.current.items).toHaveLength(3);
    const added = result.current.items[2];
    expect(added._id).toBe('char-1234567890');
    expect(added._selected).toBe(true);
    expect(added.name).toBe('新しい登場人物');
  });

  it('setItems で配列を丸ごと置き換えられること', () => {
    const { result } = renderHook(() => useEditableEntities<TestItem>(initial));

    act(() => {
      result.current.setItems([{ _id: 'c', _selected: true, name: 'キャロル', category: '仲間' }]);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].name).toBe('キャロル');
  });

  it('reset で初期状態に戻ること', () => {
    const { result } = renderHook(() => useEditableEntities<TestItem>(initial));

    act(() => {
      result.current.removeItem('a');
      result.current.toggleItem('b');
    });
    expect(result.current.items).toHaveLength(1);

    act(() => {
      result.current.reset();
    });

    expect(result.current.items).toEqual(initial);
  });
});
