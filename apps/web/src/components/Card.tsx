import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = "", onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`rounded-xl border border-border bg-surface p-4 shadow-sm transition ${
        onClick ? "cursor-pointer hover:border-primary hover:shadow-md" : ""
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
