import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useChatUI } from "@/context/ChatContext.js";
import { type ThemeMode, useTheme } from "@/hooks/useTheme.js";

export function Nav() {
  const { toggleChat, isOpen } = useChatUI();
  const { theme, setTheme } = useTheme();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(
    () => localStorage.getItem("novel-creator:nav-collapsed") === "true"
  );

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("novel-creator:nav-collapsed", String(next));
      return next;
    });
  };

  const themeOptions: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: "light", label: "ライト", icon: "☀️" },
    { mode: "dark", label: "ダーク", icon: "🌙" },
    { mode: "system", label: "自動", icon: "💻" },
  ];

  const cycleTheme = () => {
    const nextMode: ThemeMode =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(nextMode);
  };

  return (
    <aside
      aria-label="メインナビゲーション"
      aria-expanded={!isCollapsed}
      className={`flex h-full shrink-0 flex-col border-border border-r bg-surface transition-all duration-200 ${
        isCollapsed ? "w-16" : "w-56"
      }`}
    >
      {/* ヘッダー & ロゴ */}
      <div
        className={`flex items-center p-3 ${isCollapsed ? "justify-center" : "justify-between"}`}
      >
        <Link
          to="/"
          className={`flex items-center gap-2 overflow-hidden ${
            isCollapsed ? "justify-center px-0" : "px-2"
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
          {!isCollapsed && (
            <span className="truncate whitespace-nowrap font-bold text-base text-foreground tracking-tight">
              Novel Creator
            </span>
          )}
        </Link>

        {/* 折りたたみ / 展開トグルボタン */}
        {!isCollapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
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
      {isCollapsed && (
        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={toggleCollapsed}
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
      <nav className={`flex-1 space-y-1 py-2 ${isCollapsed ? "px-2" : "px-3"}`}>
        <Link
          to="/novels"
          className={`group flex items-center rounded-lg font-medium text-foreground-secondary text-sm transition hover:bg-surface-hover hover:text-foreground ${
            isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
          }`}
          activeProps={{
            className: "bg-primary-subtle text-primary-subtle-fg",
          }}
          title="小説一覧"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5 shrink-0 text-muted transition group-hover:text-foreground"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
            />
          </svg>
          {!isCollapsed && <span className="truncate">小説一覧</span>}
        </Link>

        <button
          type="button"
          onClick={toggleChat}
          className={`group flex w-full cursor-pointer items-center rounded-lg font-medium text-sm transition ${
            isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
          } ${
            isOpen
              ? "bg-primary-subtle text-primary-subtle-fg"
              : "text-foreground-secondary hover:bg-surface-hover hover:text-foreground"
          }`}
          title="AI創作相談（Ctrl+J）"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={`h-5 w-5 shrink-0 transition ${
              isOpen ? "text-primary" : "text-muted group-hover:text-foreground"
            }`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
            />
          </svg>
          {!isCollapsed && <span className="truncate">AI創作相談</span>}
        </button>

        <div className="pt-2 pb-1">
          <div className="border-border border-t" />
        </div>

        <Link
          to="/settings"
          className={`group flex items-center rounded-lg font-medium text-foreground-secondary text-sm transition hover:bg-surface-hover hover:text-foreground ${
            isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
          }`}
          activeProps={{
            className: "bg-primary-subtle text-primary-subtle-fg",
          }}
          title="LLM設定"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5 shrink-0 text-muted transition group-hover:text-foreground"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {!isCollapsed && <span className="truncate">LLM設定</span>}
        </Link>

        <Link
          to="/backup"
          className={`group flex items-center rounded-lg font-medium text-foreground-secondary text-sm transition hover:bg-surface-hover hover:text-foreground ${
            isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
          }`}
          activeProps={{
            className: "bg-primary-subtle text-primary-subtle-fg",
          }}
          title="バックアップ"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5 shrink-0 text-muted transition group-hover:text-foreground"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.5 16.556 18.375 12 18.375s-8.25-1.875-8.25-4.375v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
            />
          </svg>
          {!isCollapsed && <span className="truncate">バックアップ</span>}
        </Link>
      </nav>

      {/* テーマ切り替え & フッター */}
      <div className="space-y-2 border-border border-t p-2">
        {isCollapsed ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={cycleTheme}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface-raised text-muted-foreground text-sm shadow-xs transition hover:text-foreground"
              title={`テーマ切り替え（現在: ${
                theme === "light"
                  ? "ライト"
                  : theme === "dark"
                    ? "ダーク"
                    : "自動"
              }）`}
            >
              <span>
                {theme === "light" ? "☀️" : theme === "dark" ? "🌙" : "💻"}
              </span>
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-raised p-1 text-xs">
              {themeOptions.map((opt) => {
                const isSelected = theme === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => setTheme(opt.mode)}
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-1 rounded py-1 transition ${
                      isSelected
                        ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={`${opt.label}モードに切り替え`}
                  >
                    <span>{opt.icon}</span>
                    <span className="text-[11px]">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="px-1 text-center text-[11px] text-muted-foreground">
              <p>物語を創り、世界を紡ぐ。</p>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
