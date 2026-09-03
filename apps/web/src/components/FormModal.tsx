import type { ReactNode } from "react";
import { Button } from "./Button.js";
import { Modal } from "./Modal.js";

export interface FormModalProps {
  cancelLabel?: string;
  children: ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  size?: "sm" | "md" | "lg" | "xl";
  submitLabel?: string;
  title: string;
}

/**
 * フォーム送信用フッター（キャンセル・送信ボタン）を備えた共通フォームモーダル。
 */
export function FormModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  children,
  size = "md",
  isLoading = false,
  disabled = false,
  cancelLabel = "キャンセル",
  submitLabel = "保存",
}: FormModalProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSubmit(e);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={disabled || isLoading}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {children}
      </form>
    </Modal>
  );
}
