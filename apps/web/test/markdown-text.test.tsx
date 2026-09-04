import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownText } from "../src/components/MarkdownText.js";

// mermaid モジュールをモック: renderMermaid が呼ばれたことを検証する
const renderMock = vi.fn();
vi.mock("../src/lib/mermaid.js", () => ({
  renderMermaid: (...args: unknown[]) => renderMock(...args),
}));

beforeEach(() => {
  renderMock.mockReset();
  renderMock.mockResolvedValue(undefined);
});

describe("MarkdownText", () => {
  it("通常のマークダウンをHTMLにレンダリングする", async () => {
    const content = ["# タイトル", "", "本文です"].join("\n");
    const { container } = render(<MarkdownText content={content} />);
    await waitFor(() => {
      expect(container.querySelector("h1")).toHaveTextContent("タイトル");
      expect(container.querySelector("p")).toHaveTextContent("本文です");
    });
  });

  it("mermaid コードブロックをプレースホルダ div に差し替える", async () => {
    const content = "```mermaid\ngraph TD\nA-->B\n```";
    const { container } = render(<MarkdownText content={content} />);

    await waitFor(() => {
      const placeholder = container.querySelector(".mermaid");
      expect(placeholder).not.toBeNull();
      expect(placeholder?.textContent).toContain("graph TD");
    });
  });

  it("mermaid プレースホルダが存在する場合 renderMermaid が呼ばれる", async () => {
    const content = "```mermaid\ngraph TD\nA-->B\n```";
    render(<MarkdownText content={content} />);
    await waitFor(() => {
      expect(renderMock).toHaveBeenCalled();
    });
  });

  it("ルビ記法を後処理で <ruby> 化する", async () => {
    const { container } = render(<MarkdownText content="|漢字《かんじ》" />);
    await waitFor(() => {
      expect(container.querySelector("ruby")).not.toBeNull();
      expect(container.querySelector("rt")).toHaveTextContent("かんじ");
    });
  });

  it("mermaid ブロックがない場合は renderMermaid が呼ばれない", async () => {
    render(<MarkdownText content="# 通常見出し\n\n本文のみ" />);
    await waitFor(() => {
      expect(renderMock).not.toHaveBeenCalled();
    });
  });
});
