import type { ReactNode } from "react";

export type BadgeVariant =
  | "primary"
  | "rose"
  | "amber"
  | "emerald"
  | "blue"
  | "purple"
  | "orange"
  | "slate"
  | "muted";

export interface BadgeProps {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  size?: "sm" | "md";
  variant?: BadgeVariant;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  primary: "bg-primary/10 text-primary border-primary/30",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
  amber:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  emerald:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  purple:
    "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
  orange:
    "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
  slate:
    "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
  muted: "bg-muted/10 text-muted-foreground border-border",
};

/**
 * 状態、カテゴリ、重大度などのラベルを表示する共通バッジコンポーネント。
 */
export function Badge({
  variant = "muted",
  size = "sm",
  icon,
  children,
  className = "",
}: BadgeProps) {
  const sizeClass =
    size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs font-semibold";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-medium ${VARIANT_CLASSES[variant]} ${sizeClass} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
