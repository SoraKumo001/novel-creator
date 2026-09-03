import type { KeyboardEvent, ReactNode } from "react";

/**
 * カード類の使い分けルール。
 * - 基調: `rounded-xl border border-border bg-surface shadow-sm`
 * - 触れるカード（hoverで浮かせる）: 基調 + `interactiveCardHover`
 *   （`Card onClick`、設定/プロンプト一覧カード、タイムライン行などで共有する）
 */
export const interactiveCardHover =
  "transition hover:border-primary/50 hover:shadow-md";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = "", onClick }: CardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!onClick) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`rounded-xl border border-border bg-surface p-4 shadow-sm transition ${
        onClick
          ? `cursor-pointer ${interactiveCardHover} focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  action?: ReactNode;
  subtitle?: string;
  title: string;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <h3 className="break-words font-semibold text-base text-foreground leading-snug">
          {title}
        </h3>
        {subtitle && <p className="mt-0.5 text-muted text-xs">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
