import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntityMarkdownEditor } from "../src/routes/novels/_components/-EntityMarkdownEditor.js";

vi.mock("../src/components/HistoryDiffModal.js", () => ({
  HistoryDiffModal: () => null,
}));

vi.mock("../src/routes/novels/_components/-MonacoEditor.js", () => ({
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

  it("ツールバーボタン（保存、整形、破棄、履歴、チャットで相談）が描画されること", async () => {
    render(<EntityMarkdownEditor {...defaultProps} />);

    expect(
      await screen.findByRole("button", { name: "保存" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /整形/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /変更を破棄/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /履歴/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /チャットで相談/ })
    ).toBeInTheDocument();
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
});
