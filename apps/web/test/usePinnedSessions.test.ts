import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePinnedSessions } from '../src/hooks/usePinnedSessions.js';

const STORAGE_KEY = 'novel-creator:pinned-sessions';

beforeEach(() => {
  localStorage.clear();
});

describe('usePinnedSessions', () => {
  it('初期状態では空の Set を返すこと', () => {
    const { result } = renderHook(() => usePinnedSessions());

    expect(result.current.pinnedIds.size).toBe(0);
    expect(result.current.isPinned('sess-1')).toBe(false);
  });

  it('togglePin で追加され isPinned が true になること', () => {
    const { result } = renderHook(() => usePinnedSessions());

    act(() => {
      result.current.togglePin('sess-1');
    });

    expect(result.current.isPinned('sess-1')).toBe(true);
    expect(result.current.pinnedIds.has('sess-1')).toBe(true);
  });

  it('再度 togglePin すると削除されること', () => {
    const { result } = renderHook(() => usePinnedSessions());

    act(() => {
      result.current.togglePin('sess-1');
    });
    act(() => {
      result.current.togglePin('sess-1');
    });

    expect(result.current.isPinned('sess-1')).toBe(false);
    expect(result.current.pinnedIds.size).toBe(0);
  });

  it('togglePin 後に localStorage へシリアライズ配列が保存されること', () => {
    const { result } = renderHook(() => usePinnedSessions());

    act(() => {
      result.current.togglePin('sess-1');
    });
    act(() => {
      result.current.togglePin('sess-2');
    });

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(['sess-1', 'sess-2']);
  });

  it('localStorage に事前シードされた値が復元されること', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['sess-9']));

    const { result } = renderHook(() => usePinnedSessions());

    expect(result.current.isPinned('sess-9')).toBe(true);
    expect(result.current.pinnedIds.size).toBe(1);
  });

  it('壊れた localStorage 内容でもクラッシュせず空の Set にフォールバックすること', () => {
    localStorage.setItem(STORAGE_KEY, '{invalid json');

    const { result } = renderHook(() => usePinnedSessions());

    expect(result.current.pinnedIds.size).toBe(0);
    expect(result.current.isPinned('sess-1')).toBe(false);
  });
});
