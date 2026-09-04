import { Link } from "@tanstack/react-router";
import { NavFooter } from "./NavFooter.js";
import { NavLinks } from "./NavLinks.js";

export interface NavPanelProps {
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapsed: () => void;
}

/**
 * サイドバー本体（ヘッダー & ロゴ / ナビリンク / フッター）。
 * 表示・遷移挙動は Nav.tsx 分割前と同一。
 */
export function NavPanel({
  collapsed,
  onNavigate,
  onToggleCollapsed,
}: NavPanelProps): React.JSX.Element {
  return (
    <>
      {/* ヘッダー & ロゴ */}
      <div
        className={`flex items-center p-3 ${collapsed ? "justify-center" : "justify-between"}`}
      >
        <Link
          to="/"
          onClick={onNavigate}
          className={`flex items-center gap-2 overflow-hidden ${
            collapsed ? "justify-center px-0" : "px-2"
          }`}
          title="Novel Creator ホーム"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.967 8.967 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
          </div>
          {!collapsed && (
            <span className="truncate whitespace-nowrap font-bold text-base text-foreground tracking-tight">
              Novel Creator
            </span>
          )}
        </Link>

        {/* 折りたたみ / 展開トグルボタン */}
        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition hover:bg-surface-hover hover:text-foreground"
            title="メニューを縮小"
            aria-label="メニューを縮小"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
        )}
      </div>

      {/* 縮小時の展開トグルボタン（ロゴ直下に配置） */}
      {collapsed && (
        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition hover:bg-surface-hover hover:text-foreground"
            title="メニューを展開"
            aria-label="メニューを展開"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        </div>
      )}

      {/* ナビゲーションリンク */}
      <NavLinks collapsed={collapsed} onNavigate={onNavigate} />

      {/* テーマ切り替え & フッター */}
      <NavFooter collapsed={collapsed} onNavigate={onNavigate} />
    </>
  );
}
