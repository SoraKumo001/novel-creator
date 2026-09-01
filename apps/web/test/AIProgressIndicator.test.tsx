import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AIProgressIndicator,
  formatElapsed,
} from "../src/components/AIProgressIndicator.js";

describe("formatElapsed", () => {
  it("秒数を mm:ss 形式に正しくフォーマットする", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(5)).toBe("00:05");
    expect(formatElapsed(65)).toBe("01:05");
    expect(formatElapsed(3600)).toBe("60:00");
  });
});

describe("AIProgressIndicator", () => {
  it("パネルバリアントでステージと説明、不定プログレスバーを描画する", () => {
    render(
      <AIProgressIndicator
        stage="プロットを生成中..."
        description="設定と人物を考慮して構成案を作成しています"
        variant="panel"
      />
    );

    expect(screen.getByText("プロットを生成中...")).toBeInTheDocument();
    expect(
      screen.getByText("設定と人物を考慮して構成案を作成しています")
    ).toBeInTheDocument();
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute("aria-busy", "true");
  });

  it("決定型プログレスバーでパーセンテージと件数を表示する", () => {
    render(
      <AIProgressIndicator
        stage="章構成を解析中..."
        current={3}
        total={10}
        variant="panel"
      />
    );

    expect(screen.getByText(/3 \/ 10/)).toBeInTheDocument();
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "30");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");
  });

  it("キャンセルボタンが押されたとき onCancel コールバックを呼び出す", () => {
    const handleCancel = vi.fn();
    render(
      <AIProgressIndicator
        stage="処理中"
        onCancel={handleCancel}
        cancelLabel="中止する"
      />
    );

    const button = screen.getByRole("button", { name: "中止する" });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it("inline バリアントでコンパクトに描画する", () => {
    const handleCancel = vi.fn();
    render(
      <AIProgressIndicator
        stage="自動抽出中..."
        variant="inline"
        percent={50}
        onCancel={handleCancel}
      />
    );

    expect(screen.getByText("自動抽出中...")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "キャンセル" })
    ).toBeInTheDocument();
  });

  it("compact バリアントで描画する", () => {
    render(<AIProgressIndicator stage="思考中..." variant="compact" />);

    expect(screen.getByText("思考中...")).toBeInTheDocument();
  });
});
