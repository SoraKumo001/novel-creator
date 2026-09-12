import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExportModal } from "../src/components/ExportModal.js";
import { ToastProvider } from "../src/components/Toast.js";

describe("ExportModal component XSS sanitization", () => {
  const mockNovel = {
    chapters: [
      {
        order: 1,
        sections: [
          {
            content:
              "これは本文です。<script>alert('xss')</script><img src=x onerror=alert('img-xss') />",
            order: 1,
            title: "節1",
          },
        ],
        title: "第1章",
      },
    ],
    description: "説明文",
    title: "テスト小説",
  };

  it("HTMLプレビュー時に悪意あるスクリプトやイベントハンドラがサニタイズされること", () => {
    const { container } = render(
      <ToastProvider>
        <ExportModal isOpen={true} novel={mockNovel} onClose={vi.fn()} />
      </ToastProvider>
    );

    // ルビ形式を HTML に切り替え
    const rubySelect = screen.getByDisplayValue(/保持/);
    fireEvent.change(rubySelect, { target: { value: "html" } });

    // 「HTMLプレビュー」ボタンをクリック
    const previewBtn = screen.getByRole("button", { name: "HTMLプレビュー" });
    fireEvent.click(previewBtn);

    // script タグが存在しないこと
    expect(container.querySelector("script")).toBeNull();

    // img の onerror 属性が除去されていること
    const img = container.querySelector("img");
    if (img) {
      expect(img.getAttribute("onerror")).toBeNull();
    }
  });
});
