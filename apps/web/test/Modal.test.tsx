import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "../src/components/Modal.js";

describe("Modal component", () => {
  it("isOpen=true のときにタイトルとコンテンツが表示されること", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="テストダイアログ">
        <p>ダイアログ本文</p>
      </Modal>
    );

    expect(screen.getByText("テストダイアログ")).toBeInTheDocument();
    expect(screen.getByText("ダイアログ本文")).toBeInTheDocument();
  });

  it("isOpen=false のときは何も表示されないこと", () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()} title="テストダイアログ">
        <p>ダイアログ本文</p>
      </Modal>
    );

    expect(container.firstChild).toBeNull();
  });

  it("閉じるボタン（×）をクリックすると onClose が呼ばれること", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="テストダイアログ">
        <p>ダイアログ本文</p>
      </Modal>
    );

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape キーを押すと onClose が呼ばれること", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="テストダイアログ">
        <p>ダイアログ本文</p>
      </Modal>
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ダイアログ内部で mousedown して backdrop 上で mouseup/click しても onClose が呼ばれないこと（テキスト選択時のエリア外マウスアップ）", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="テストダイアログ">
        <p data-testid="modal-text">選択対象のテキスト</p>
      </Modal>
    );

    const textElement = screen.getByTestId("modal-text");
    const backdropElement = screen.getByTestId("modal-backdrop");

    // モーダル内部のテキストで mousedown
    fireEvent.mouseDown(textElement);

    // backdrop 上で click（ブラウザが内部mousedown + 外側mouseup時に発生させるclickを再現）
    fireEvent.click(backdropElement);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("backdrop 上で直接 mousedown して click された場合は onClose が呼ばれること", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="テストダイアログ">
        <p>ダイアログ本文</p>
      </Modal>
    );

    const backdropElement = screen.getByTestId("modal-backdrop");

    // backdrop 上で mousedown
    fireEvent.mouseDown(backdropElement);

    // backdrop 上で click
    fireEvent.click(backdropElement);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
