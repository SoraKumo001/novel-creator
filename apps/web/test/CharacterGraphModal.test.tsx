import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterGraphModal } from "../src/components/CharacterGraphModal.js";

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};
vi.mock("@/hooks/useToast.js", () => ({
  useToast: () => mockToast,
}));

vi.mock("@/lib/mermaid.js", () => ({
  renderMermaid: vi.fn().mockResolvedValue(undefined),
}));

describe("CharacterGraphModal", () => {
  const characters = [
    {
      id: "char-1",
      name: "主人公",
      category: "主要人物",
      relationships: "ヒロイン: 仲間",
    },
    {
      id: "char-2",
      name: "ヒロイン",
      category: "主要人物",
      relationships: "主人公: 信頼",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isOpen=false のときは何も描画されないこと", () => {
    render(
      <CharacterGraphModal
        isOpen={false}
        onClose={vi.fn()}
        characters={characters}
      />
    );
    expect(
      screen.queryByText("人物相関図・勢力図 (Mermaid)")
    ).not.toBeInTheDocument();
  });

  it("isOpen=true のときにタイトルと Mermaid コンテナが描画されること", () => {
    render(
      <CharacterGraphModal
        isOpen={true}
        onClose={vi.fn()}
        characters={characters}
      />
    );
    expect(
      screen.getByText("人物相関図・勢力図 (Mermaid)")
    ).toBeInTheDocument();
    expect(screen.getByText(/登場人物のカテゴリ/)).toBeInTheDocument();
  });

  it("「Mermaid コード表示」ボタンでコードテキストエリアに切り替わること", () => {
    render(
      <CharacterGraphModal
        isOpen={true}
        onClose={vi.fn()}
        characters={characters}
      />
    );

    const toggleButton = screen.getByRole("button", {
      name: /Mermaid コード表示/,
    });
    fireEvent.click(toggleButton);

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /図を表示/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /コードをコピー/ })
    ).toBeInTheDocument();
  });

  it("コードコピー時に clipboard.writeText が呼ばれ、トーストが表示されること", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <CharacterGraphModal
        isOpen={true}
        onClose={vi.fn()}
        characters={characters}
      />
    );

    // コード表示に切り替え
    fireEvent.click(screen.getByRole("button", { name: /Mermaid コード表示/ }));

    // コピーボタンをクリック
    fireEvent.click(screen.getByRole("button", { name: /コードをコピー/ }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith(
        "Mermaid コードをコピーしました"
      );
    });
  });
});
