import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StyleGuideModal } from "../src/components/StyleGuideModal.js";

// MonacoEditor のモック
vi.mock("../src/routes/novels/_components/-MonacoEditor.js", () => ({
  MonacoEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (val: string) => void;
  }) => (
    <textarea
      data-testid="monaco-mock"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const mockGenerateStyleGuideDraft = vi.fn();
vi.mock("@/lib/services/novel.js", () => ({
  generateStyleGuideDraft: (...args: unknown[]) =>
    mockGenerateStyleGuideDraft(...args),
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};
vi.mock("@/hooks/useToast.js", () => ({
  useToast: () => mockToast,
}));

describe("StyleGuideModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初期値がエディタに表示されること", () => {
    render(
      <StyleGuideModal
        isOpen={true}
        onClose={vi.fn()}
        novelId="novel-1"
        initialStyleGuide="# 視点\n一人称（俺）"
        onSave={vi.fn()}
      />
    );

    const textarea = screen.getByTestId("monaco-mock") as HTMLTextAreaElement;
    expect(textarea.value).toContain("# 視点");
    expect(textarea.value).toContain("一人称（俺）");
  });

  it("テンプレートをクリックすると確認後に内容が適用されること", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <StyleGuideModal
        isOpen={true}
        onClose={vi.fn()}
        novelId="novel-1"
        initialStyleGuide=""
        onSave={vi.fn()}
      />
    );

    const applyButtons = screen.getAllByText("📥 このテンプレートを適用");
    expect(applyButtons.length).toBeGreaterThan(0);

    fireEvent.click(applyButtons[0]);

    const textarea = screen.getByTestId("monaco-mock") as HTMLTextAreaElement;
    expect(textarea.value).toContain("# 視点・人称");
  });

  it("スニペットタブに切り替えてスニペットを追記できること", async () => {
    render(
      <StyleGuideModal
        isOpen={true}
        onClose={vi.fn()}
        novelId="novel-1"
        initialStyleGuide="初期テキスト"
        onSave={vi.fn()}
      />
    );

    // スニペットタブへ切り替え
    const snippetsTabButton = screen.getByText(/スニペット追加/);
    fireEvent.click(snippetsTabButton);

    // スニペットの「末尾に追加」ボタンを押す
    const insertButtons = screen.getAllByText("➕ 末尾に追加");
    expect(insertButtons.length).toBeGreaterThan(0);

    fireEvent.click(insertButtons[0]);

    const textarea = screen.getByTestId("monaco-mock") as HTMLTextAreaElement;
    expect(textarea.value).toContain("初期テキスト");
    expect(textarea.value).toContain("## 視点・人称");
  });

  it("AI下書き生成ボタンを押すと下書きが生成されること", async () => {
    mockGenerateStyleGuideDraft.mockResolvedValueOnce(
      "# AI生成ガイドライン\n- 一人称: 僕"
    );

    render(
      <StyleGuideModal
        isOpen={true}
        onClose={vi.fn()}
        novelId="novel-1"
        initialStyleGuide=""
        onSave={vi.fn()}
      />
    );

    const draftButton = screen.getByText("作品に合うガイドラインを下書き生成");
    fireEvent.click(draftButton);

    await waitFor(() => {
      expect(mockGenerateStyleGuideDraft).toHaveBeenCalledWith("novel-1");
      const textarea = screen.getByTestId("monaco-mock") as HTMLTextAreaElement;
      expect(textarea.value).toBe("# AI生成ガイドライン\n- 一人称: 僕");
    });
  });

  it("保存ボタンを押すと onSave が呼ばれてモーダルが閉じること", async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    const mockClose = vi.fn();

    render(
      <StyleGuideModal
        isOpen={true}
        onClose={mockClose}
        novelId="novel-1"
        initialStyleGuide="保存テスト"
        onSave={mockSave}
      />
    );

    const saveButton = screen.getByText("保存する");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith("保存テスト");
      expect(mockClose).toHaveBeenCalled();
    });
  });
});
