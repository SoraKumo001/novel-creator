import {
  buildCharacterTree,
  type CharacterCategoryNode,
  type CharacterSectionRange,
  findCharacterAtLine,
} from "@novel-creator/shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  type MonacoEditorInstance,
  useMarkdownEntityEditor,
} from "../src/hooks/useMarkdownEntityEditor.js";

const sampleMarkdown = `# 主要人物

## 大正一
正義感の強い主人公。

### 特徴
- 勇敢
- 剣術が得意

## ヒロイン
心優しい魔法使い。
`;

describe("useMarkdownEntityEditor", () => {
  it("初期ロード後にエディタのカーソル位置（1-indexed）から activeSection が正しく特定されること", async () => {
    let cursorPositionCallback:
      | ((e: { position: { lineNumber: number; column: number } }) => void)
      | null = null;
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
        storageKey: "test-key",
        fetchMarkdown: async () => sampleMarkdown,
        buildTree: buildCharacterTree,
        findSectionAtLine: findCharacterAtLine,
      })
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
    expect(result.current.activeSection?.name).toBe("大正一");
    expect(result.current.activeSection?.category).toBe("主要人物");

    // カーソルを「ヒロイン」セクション（10行目）に移動
    act(() => {
      cursorPositionCallback?.({ position: { lineNumber: 10, column: 1 } });
    });

    expect(result.current.activeSection?.name).toBe("ヒロイン");

    // handleTreeClick でジャンプした場合のテスト
    // 大正一の headingLine は 2 (0-indexed)
    act(() => {
      result.current.handleTreeClick(2);
    });

    expect(mockEditor.revealLineInCenter).toHaveBeenCalledWith(3);
    expect(mockEditor.setPosition).toHaveBeenCalledWith({
      lineNumber: 3,
      column: 1,
    });
    expect(result.current.activeSection?.name).toBe("大正一");
  });

  it("編集後に markdown/Dirty は即時反映し、ToCツリーは遅延追従すること", async () => {
    const { result } = renderHook(() =>
      useMarkdownEntityEditor<CharacterCategoryNode[], CharacterSectionRange>({
        storageKey: "test-key-deferred",
        fetchMarkdown: async () => sampleMarkdown,
        buildTree: buildCharacterTree,
        findSectionAtLine: findCharacterAtLine,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const edited = `${sampleMarkdown}\n## 新人物\n追加された人物。\n`;
    act(() => {
      result.current.handleEditorChange(edited);
    });

    // 保存・Dirty 判定は即時 markdown ベース
    expect(result.current.markdown).toBe(edited);
    expect(result.current.isDirty).toBe(true);

    // ToCツリーは遅延値から再計算され、最終的に新見出しを拾う
    await waitFor(() => {
      const names = result.current.tree.flatMap((node) => [
        ...node.children.map((c) => c.name),
      ]);
      expect(names).toContain("新人物");
    });
  });

  it("分割幅リサイズが一本化された useSidebarResize に委譲され、最大幅でクランプ＋永続化されること", async () => {
    localStorage.clear();
    const { result } = renderHook(() =>
      useMarkdownEntityEditor<CharacterCategoryNode[], CharacterSectionRange>({
        storageKey: "test-key-resize",
        fetchMarkdown: async () => sampleMarkdown,
        buildTree: buildCharacterTree,
        findSectionAtLine: findCharacterAtLine,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.sidebarWidth).toBe(256);

    // ドラッグ開始→大きく右へ→最大 600 でクランプされること
    act(() => {
      result.current.handleSplitterMouseDown({
        preventDefault: () => {},
        clientX: 100,
      } as unknown as ReactMouseEvent);
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 10_000 }));
    });
    expect(result.current.sidebarWidth).toBe(600);

    // mouseup で localStorage に永続化されること
    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"));
    });
    expect(localStorage.getItem("test-key-resize:sidebar-width")).toBe("600");

    // 大きく左へ→最小 160 でクランプされること
    act(() => {
      result.current.handleSplitterMouseDown({
        preventDefault: () => {},
        clientX: 600,
      } as unknown as ReactMouseEvent);
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: -10_000 }));
    });
    expect(result.current.sidebarWidth).toBe(160);
    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"));
    });
  });
});
