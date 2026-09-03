import type { ReactNode } from "react";
import { Card } from "./Card.js";

interface StatCardProps {
  action?: ReactNode;
  className?: string;
  footer?: ReactNode;
  label: string;
  value: ReactNode;
}

/**
 * 概要統計カード。目標文字数カードも action / footer スロットで統一する。
 * action / footer なしの見た目は従来の StatCard と同一、
 * ありの場合は従来の目標文字数カードと同一になるよう条件分岐する。
 */
export function StatCard({
  label,
  value,
  action,
  footer,
  className = "",
}: StatCardProps) {
  const hasCustom = action !== undefined || footer !== undefined;
  return (
    <Card
      className={`${hasCustom ? "flex flex-col justify-between" : ""} ${className}`}
    >
      <div>
        {action ? (
          <div className="flex items-center justify-between gap-2 font-semibold text-muted-foreground text-xs">
            <span>{label}</span>
            {action}
          </div>
        ) : (
          <div className="text-slate-500 text-sm dark:text-slate-400">
            {label}
          </div>
        )}
        <div
          className={
            hasCustom
              ? "mt-1 break-words font-bold text-foreground text-xl tabular-nums sm:text-2xl"
              : "mt-1 break-words font-bold text-slate-900 text-xl tabular-nums sm:text-2xl dark:text-slate-100"
          }
        >
          {value}
        </div>
      </div>
      {footer && (
        <div className="mt-2 text-[11px] text-muted-foreground">{footer}</div>
      )}
    </Card>
  );
}
