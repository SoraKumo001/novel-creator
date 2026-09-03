import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormModal } from "../src/components/FormModal.js";

describe("FormModal", () => {
  it("タイトル、中身、ボタンが正しく描画され、送信できること", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();

    render(
      <FormModal
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
        title="テストフォーム"
        submitLabel="送信"
      >
        <input data-testid="test-input" defaultValue="テスト入力" />
      </FormModal>
    );

    expect(screen.getByText("テストフォーム")).toBeInTheDocument();
    expect(screen.getByTestId("test-input")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "送信" }));
    expect(onSubmit).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onClose).toHaveBeenCalled();
  });
});
