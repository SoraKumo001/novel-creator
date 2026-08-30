import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  useMarkdownEntityEditor,
  type MonacoEditorInstance,
} from '../src/hooks/useMarkdownEntityEditor.js';
import {
  buildCharacterTree,
  findCharacterAtLine,
  type CharacterCategoryNode,
  type CharacterSectionRange,
} from '@novel-creator/shared';

const sampleMarkdown = `# 主要人物

## 大正一
正義感の強い主人公。

### 特徴
- 勇敢
- 剣術が得意

## ヒロイン
心優しい魔法使い。
`;

describe('useMarkdownEntityEditor', () => {
  it('初期ロード後にエディタのカーソル位置（1-indexed）から activeSection が正しく特定されること', async () => {
    let cursorPositionCallback:
      ((e: { position: { lineNumber: number; column: number } }) => void) | null = null;
    let currentPosition = { lineNumber: 3, column: 1 }; // 3行目は `## 大正一`

    const mockEditor = {
      getPosition: vi.fn(() => currentPosition),
      onDidChangeCursorPosition: vi.fn((cb) => {
        cursorPositionCallback = cb;
        return { dispose: vi.fn() };
      }),
      revealLineInCenter: vi.fn(),
      setPosition: vi.fn((pos) => {
        currentPosition = pos;
        if (cursorPositionCallback) {
          cursorPositionCallback({ position: pos });
        }
      }),
      focus: vi.fn(),
    } as unknown as MonacoEditorInstance;

    const { result } = renderHook(() =>
      useMarkdownEntityEditor<CharacterCategoryNode[], CharacterSectionRange>({
        storageKey: 'test-key',
        fetchMarkdown: async () => sampleMarkdown,
        buildTree: buildCharacterTree,
        findSectionAtLine: findCharacterAtLine,
      }),
    );

    // markdown ロード完了待ち
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.markdown).toBe(sampleMarkdown);
    });

    // エディタマウント
    act(() => {
      result.current.handleEditorMount(mockEditor);
    });

    // 初期カーソル（3行目: ## 大正一）で activeSection が大正一になっていること
    expect(result.current.activeSection).not.toBeNull();
    expect(result.current.activeSection?.name).toBe('大正一');
    expect(result.current.activeSection?.category).toBe('主要人物');

    // カーソルを「ヒロイン」セクション（10行目）に移動
    act(() => {
      cursorPositionCallback?.({ position: { lineNumber: 10, column: 1 } });
    });

    expect(result.current.activeSection?.name).toBe('ヒロイン');

    // handleTreeClick でジャンプした場合のテスト
    // 大正一の headingLine は 2 (0-indexed)
    act(() => {
      result.current.handleTreeClick(2);
    });

    expect(mockEditor.revealLineInCenter).toHaveBeenCalledWith(3);
    expect(mockEditor.setPosition).toHaveBeenCalledWith({ lineNumber: 3, column: 1 });
    expect(result.current.activeSection?.name).toBe('大正一');
  });
});
