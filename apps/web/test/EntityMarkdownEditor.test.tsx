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

vi.mock("@/context/ChatContext.js", () => ({
  useChatUI: () => ({
    openChat: vi.fn(),
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
    onEditSection: vi.fn().mockResolvedValue("更新後"),
    onEditDocument: vi.fn().mockResolvedValue("更新後全体"),
    savingMarkdown: false,
    editingSection: false,
    editingDocument: false,
  };

  it("LLM編集実行中（editingDocument=true）に AIProgressIndicator が表示されること", async () => {
    render(<EntityMarkdownEditor {...defaultProps} editingDocument={true} />);

    // マークダウン読み込み完了後、AIProgressIndicator のメッセージが表示される
    expect(
      await screen.findByText(/AIが人物マークダウン全体を再編成・推敲中.../)
    ).toBeInTheDocument();
  });

  it("LLM編集実行中（editingSection=true）にセクション名付きのプログレスが表示されること", async () => {
    render(<EntityMarkdownEditor {...defaultProps} editingSection={true} />);

    expect(
      await screen.findByText(/AIが「人物」を推敲・編集案を生成中.../)
    ).toBeInTheDocument();
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
