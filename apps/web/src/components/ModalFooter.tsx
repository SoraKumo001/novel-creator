import type { ReactNode } from "react";
import { Button } from "./Button.js";

export type ModalFooterButtonVariant =
  | "danger"
  | "ghost"
  | "primary"
  | "secondary";

export interface ModalFooterButton {
  disabled?: boolean;
  isLoading?: boolean;
  label: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: ModalFooterButtonVariant;
}

export interface ModalFooterProps {
  align?: "between" | "end";
  /**
   * 既定trueで罫線・余白付き。Modalのfooter枠を使う場合はfalseにし、
   * 二重罫線を避ける（後方互換のため既存利用の描画は不変）。
   */
  bordered?: boolean;
  leading?: ReactNode;
  primary?: ModalFooterButton;
  secondary?: ModalFooterButton;
  size?: "lg" | "md" | "sm";
}

/**
 * Modal直利用向けの共通フッター。
 * 右寄せ（secondary→primaryの順）を既定とし、leading指定時は
 * 左右分割（例: 左に接続テスト、右にキャンセル/保存）になる。
 * FormModal・ConfirmDialogは独自フッターのため対象外。
 * ConfigFormModalは align="between" + leading で本コンポーネントを利用する。
 */
export function ModalFooter({
  align = "end",
  bordered = true,
  leading,
  primary,
  secondary,
  size = "sm",
}: ModalFooterProps) {
  const buttons = (
    <>
      {secondary && (
        <Button
          type={secondary.type ?? "button"}
          variant={secondary.variant ?? "secondary"}
          size={size}
          onClick={secondary.onClick}
          disabled={secondary.disabled}
          isLoading={secondary.isLoading}
        >
          {secondary.label}
        </Button>
      )}
      {primary && (
        <Button
          type={primary.type ?? "submit"}
          variant={primary.variant ?? "primary"}
          size={size}
          onClick={primary.onClick}
          disabled={primary.disabled}
          isLoading={primary.isLoading}
        >
          {primary.label}
        </Button>
      )}
    </>
  );

  const justify = align === "between" ? "justify-between" : "justify-end";
  const containerClass = bordered
    ? `flex items-center ${justify} gap-2 border-border border-t pt-2`
    : `flex w-full items-center ${justify} gap-2`;

  return (
    <div className={containerClass}>
      {leading}
      {leading ? (
        <div className="flex items-center gap-2">{buttons}</div>
      ) : (
        buttons
      )}
    </div>
  );
}
