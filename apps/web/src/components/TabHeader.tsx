import type { ReactNode } from "react";

export interface TabHeaderProps {
  children?: ReactNode;
  className?: string;
  leftExtra?: ReactNode;
  rightControls?: ReactNode;
  title: string;
  viewModeSwitch?: ReactNode;
}

/**
 * 各タブの最上部に表示される見出し・ツールバーコンポーネント。
 *
 * - 左側: タブ見出し（h2） + leftExtra（折りたたみボタン等の補助操作）
 * - 右側: rightControls（フィルタ、新規作成ボタン等） + viewModeSwitch（右端固定の表示切替）
 */
export function TabHeader({
  title,
  leftExtra,
  rightControls,
  viewModeSwitch,
  children,
  className = "",
}: TabHeaderProps) {
  return (
    <div
      className={`flex shrink-0 flex-wrap items-center justify-between gap-3 border-border border-b pb-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        <h2 className="font-bold text-foreground text-xl">{title}</h2>
        {leftExtra}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {rightControls}
        {children}
        {viewModeSwitch}
      </div>
    </div>
  );
}
