import { NavPanel } from "./NavPanel.js";
import { useMobileNav, useNavCollapsed } from "./useNavState.js";

export function Nav(): React.JSX.Element {
  const { isCollapsed, toggleCollapsed } = useNavCollapsed();
  const { isMobileOpen, openMobileNav, closeMobileNav } = useMobileNav();

  return (
    <>
      {/* モバイル用ハンバーガーボタン（チャットFABと対称の左下配置） */}
      <button
        type="button"
        onClick={openMobileNav}
        className="fixed bottom-6 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-lg transition hover:bg-surface-hover md:hidden"
        aria-label="メニューを開く"
        aria-expanded={isMobileOpen}
        title="メニュー"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
          />
        </svg>
      </button>

      {/* デスクトップ用サイドバー */}
      <aside
        aria-label="メインナビゲーション"
        aria-expanded={!isCollapsed}
        className={`hidden h-full shrink-0 flex-col border-border border-r bg-surface transition-all duration-200 md:flex ${
          isCollapsed ? "w-16" : "w-56"
        }`}
      >
        <NavPanel collapsed={isCollapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      {/* モバイル用ドロワー */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={closeMobileNav}
            aria-hidden="true"
          />
          <aside
            aria-label="メインナビゲーション"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-border border-r bg-surface shadow-2xl"
          >
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={closeMobileNav}
                className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition hover:bg-surface-hover hover:text-foreground"
                aria-label="メニューを閉じる"
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <NavPanel
                collapsed={false}
                onNavigate={closeMobileNav}
                onToggleCollapsed={toggleCollapsed}
              />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
