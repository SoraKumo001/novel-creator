import { forwardRef, type SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/**
 * 標準フォームスタイルの select。Input / Textarea と同じテーマトークン
 * （rounded-lg / border-border / bg-surface / text-foreground）を基本クラスとして共通化する。
 *
 * 幅・パディング・文字サイズ・フォーカスリングなど箇所固有の差分は className で
 * 「追加」する。基本クラスには全使用箇所で共通のトークンのみを含めているため、
 * className 側とユーティリティが重複せず（上書き競合が起きず）、
 * 既存の生 <select> と完全に同じクラスセットを維持できる。
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", ...props }, ref) => (
    <select
      ref={ref}
      className={`rounded-lg border border-border bg-surface text-foreground ${className}`}
      {...props}
    />
  )
);

Select.displayName = "Select";
