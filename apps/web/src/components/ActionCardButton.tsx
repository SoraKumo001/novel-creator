import type { ReactNode } from "react";

interface ActionCardButtonProps {
  description: string;
  icon: ReactNode;
  onClick: () => void;
  title: string;
}

/**
 * 分析・レビュー系のカード型ボタン。絵文字アイコン・タイトル・説明で構成する。
 */
export function ActionCardButton({
  icon,
  title,
  description,
  onClick,
}: ActionCardButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 cursor-pointer flex-col items-start rounded-xl border border-border bg-surface-raised p-3.5 text-left transition hover:border-primary hover:bg-primary/5"
    >
      <span className="mb-1 text-2xl">{icon}</span>
      <div className="font-bold text-foreground text-sm group-hover:text-primary">
        {title}
      </div>
      <div className="mt-1 text-muted-foreground text-xs leading-relaxed">
        {description}
      </div>
    </button>
  );
}
