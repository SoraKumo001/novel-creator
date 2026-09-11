import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntityMarkdownEditor } from "../src/features/editor/components/EntityMarkdownEditor.js";

vi.mock("../src/components/HistoryDiffModal.js", () => ({
  HistoryDiffModal: () => null,
}));

vi.mock("../src/features/editor/components/MonacoEditor.js", () => ({
  MonacoEditor: ({
    onChange,
    value,
  }: {
    onChange?: (val: string) => void;
    value: string;
  }) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

const mockOpenChat = vi.fn();
vi.mock("@/context/ChatContext.js", () => ({
  useChatUI: () => ({
    openChat: mockOpenChat,
    isOpen: false,
  }),
}));

const mockToast = {
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
};

vi.mock("@/hooks/useToast.js", () => ({
  useToast: () => mockToast,
}));

describe("EntityMarkdownEditor", () => {
  const defaultProps = {
    novelId: "novel-1",
    entityTitle: "人物",
    entityType: "characters_markdown" as const,
    storageKey: "test-key",
    fetchMarkdown: vi.fn().mockResolvedValue("# 主要人物\n\n## アリス\n説明"),
    saveMarkdown: vi
      .fn()
      .mockResolvedValue({ created: 0, updated: 1, deleted: 0 }),
    buildTree: vi.fn().mockReturnValue([
      {
        category: "主要人物",
        headingLine: 0,
        children: [{ name: "アリス", headingLine: 2 }],
      },
    ]),
    findSectionAtLine: vi
      .fn()
      .mockReturnValue({ category: "主要人物", name: "アリス" }),
    savingMarkdown: false,
  };

  it("タイトル、保存ステータス、文字数、ツールバーボタン（保存、整形、破棄、チャット相談、表示）が描画されること", async () => {
    render(<EntityMarkdownEditor {...defaultProps} />);

    expect(await screen.findByText("人物")).toBeInTheDocument();
    expect(screen.getByText("保存完了")).toBeInTheDocument();
    expect(screen.getByText(/文字数:/)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /整形/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /変更を破棄/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /チャットで相談/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /表示/ })).toBeInTheDocument();

    // 表示ドロップダウンを開くと履歴ボタンが存在すること
    const { act, fireEvent } = await import("@testing-library/react");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /表示/ }));
    });
    expect(screen.getByRole("button", { name: /履歴/ })).toBeInTheDocument();
  });

  it("「チャットで相談」をクリックすると openChat が呼び出されること", async () => {
    render(<EntityMarkdownEditor {...defaultProps} />);

    const chatButton = await screen.findByRole("button", {
      name: /チャットで相談/,
    });
    const { act, fireEvent } = await import("@testing-library/react");
    await act(async () => {
      fireEvent.click(chatButton);
    });

    expect(mockOpenChat).toHaveBeenCalledWith(
      "novel-1",
      expect.objectContaining({
        title: expect.stringContaining("人物"),
      })
    );
  });

  it("保存成功時に一部項目がundefinedでも0件に補正され、undefinedと表示されないこと", async () => {
    const saveMarkdown = vi.fn().mockResolvedValue({ updated: 1 });
    render(
      <EntityMarkdownEditor {...defaultProps} saveMarkdown={saveMarkdown} />
    );

    const editor = await screen.findByTestId("monaco-editor");
    const { act, fireEvent } = await import("@testing-library/react");
    await act(async () => {
      fireEvent.change(editor, {
        target: { value: "# 主要人物\n\n## ボブ\n説明" },
      });
    });

    const saveButton = screen.getByRole("button", { name: "保存" });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await vi.waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        "保存しました (作成: 0件, 更新: 1件, 削除: 0件)"
      );
    });
  });

  it("件数情報がない場合はシンプルな「保存しました」と表示されること", async () => {
    const saveMarkdown = vi.fn().mockResolvedValue({});
    render(
      <EntityMarkdownEditor {...defaultProps} saveMarkdown={saveMarkdown} />
    );

    const editor = await screen.findByTestId("monaco-editor");
    const { act, fireEvent } = await import("@testing-library/react");
    await act(async () => {
      fireEvent.change(editor, {
        target: { value: "# 主要人物\n\n## キャロル\n説明" },
      });
    });

    const saveButton = screen.getByRole("button", { name: "保存" });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await vi.waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("保存しました");
    });
  });

  it("Monaco最小設定（検索・文字サイズ・折返し）が動作し、文字サイズ変更が永続化されること", async () => {
    localStorage.clear();
    render(<EntityMarkdownEditor {...defaultProps} />);

    expect(
      await screen.findByRole("button", { name: /検索/ })
    ).toBeInTheDocument();

    const { act, fireEvent } = await import("@testing-library/react");
    // エディタ未マウントでも検索ボタンは no-op で落ちないこと
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /検索/ }));
    });

    // 「表示」ドロップダウンを開く
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /表示/ }));
    });

    expect(screen.getByRole("button", { name: /小さく/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /大きく/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /折り返し/ })
    ).toBeInTheDocument();

    // A+ (大きく) で 16 に永続化されること
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /大きく/ }));
    });
    expect(localStorage.getItem("test-key:monaco-font-size")).toBe("16");

    // 折返しトグルで off が永続化されること
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /折り返し/ }));
    });
    expect(localStorage.getItem("test-key:monaco-word-wrap")).toBe("off");
  });

  it("プレビュードックは既定で閉じており、表示メニューから開くと横プレビューが表示されること", async () => {
    localStorage.clear();
    render(<EntityMarkdownEditor {...defaultProps} />);
    await screen.findByTestId("monaco-editor");

    expect(
      screen.queryByRole("complementary", { name: "プレビュー" })
    ).not.toBeInTheDocument();

    const { act, fireEvent } = await import("@testing-library/react");
    // 表示メニューを開いてプレビューを表示
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /表示/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /プレビューを表示/ }));
    });

    const dock = await screen.findByRole("complementary", {
      name: "プレビュー",
    });
    // 横=GFMフルレンダ（MarkdownText 再利用）
    expect(
      within(dock).getByRole("heading", { name: "主要人物" })
    ).toBeInTheDocument();
  });

  it("縦切替でルビ付き縦書き表示になり、閉じるとドックが消えること", async () => {
    localStorage.clear();
    const fetchMarkdown = vi
      .fn()
      .mockResolvedValue("# 体験版\n\n|漢字《かんじ》です。");
    render(
      <EntityMarkdownEditor {...defaultProps} fetchMarkdown={fetchMarkdown} />
    );
    await screen.findByTestId("monaco-editor");

    const { act, fireEvent } = await import("@testing-library/react");
    // 表示メニューを開いてプレビューを表示
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /表示/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /プレビューを表示/ }));
    });

    const dock = await screen.findByRole("complementary", {
      name: "プレビュー",
    });

    await act(async () => {
      fireEvent.click(within(dock).getByRole("button", { name: "縦" }));
    });

    // 縦=行分割+ルビ（共通 sanitize 維持）
    const vertical = within(dock).getByTestId("preview-vertical");
    expect(vertical).toHaveStyle({ writingMode: "vertical-rl" });
    expect(vertical.querySelector("ruby")).not.toBeNull();
    expect(vertical.querySelector("rt")).toHaveTextContent("かんじ");
    expect(vertical.querySelector("script")).toBeNull();

    await act(async () => {
      fireEvent.click(
        within(dock).getByRole("button", { name: "プレビューを閉じる" })
      );
    });
    expect(
      screen.queryByRole("complementary", { name: "プレビュー" })
    ).not.toBeInTheDocument();
  });
});
