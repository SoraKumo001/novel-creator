import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { EditProfileModal } from "@/components/EditProfileModal.js";
import { useAuth } from "@/hooks/useAuth.js";
import { type ThemeMode, useTheme } from "@/hooks/useTheme.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";

const themeOptions: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: "light", label: "ライト", icon: "☀️" },
  { mode: "dark", label: "ダーク", icon: "🌙" },
  { mode: "system", label: "自動", icon: "💻" },
];

export interface NavFooterProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

/**
 * テーマ切り替え & フッター（ユーザー表示 / ログイン / ログアウト）。
 * 表示・遷移挙動は Nav.tsx 分割前と同一。
 */
export function NavFooter({
  collapsed,
  onNavigate,
}: NavFooterProps): React.JSX.Element {
  const { theme, setTheme } = useTheme();
  const { user, isAuthenticated, isAdmin, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const cycleTheme = (): void => {
    const nextMode: ThemeMode =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(nextMode);
  };

  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut();
      toast.success("ログアウトしました");
      onNavigate?.();
      await navigate({ to: "/login" });
    } catch (e) {
      toast.error(toErrorMessage(e));
    }
  };

  const displayName = user?.name || user?.email || "ログイン中";
  const roleLabel = isAdmin ? "管理者" : "一般";

  return (
    <div className="space-y-2 border-border border-t p-2">
      {!collapsed && (
        <div className="rounded-lg border border-border bg-surface-raised px-2.5 py-2">
          {isAuthenticated ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p
                    className="truncate font-medium text-foreground text-xs"
                    title={displayName}
                  >
                    {displayName}
                  </p>
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(true)}
                    className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground transition hover:bg-surface-hover hover:text-foreground"
                    title="ユーザー名を変更"
                    aria-label="ユーザー名を変更"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3 w-3"
                    >
                      <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.882l-3.154 1.262a.5.5 0 01-.65-.65z" />
                      <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                    </svg>
                  </button>
                  <span
                    className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 font-semibold text-[10px] ${
                      isAdmin
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "border-border bg-surface-hover text-muted-foreground"
                    }`}
                  >
                    {isAdmin ? "👑 管理者" : "👤 一般"}
                  </span>
                </div>
                {user?.name && user?.email && (
                  <p
                    className="truncate text-[10px] text-muted-foreground"
                    title={user.email}
                  >
                    {user.email}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-muted-foreground text-xs transition hover:bg-surface-hover hover:text-foreground"
                title="ログアウト"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              onClick={onNavigate}
              className="block rounded-md px-2 py-1 text-center text-muted-foreground text-xs transition hover:bg-surface-hover hover:text-foreground"
              title="ログイン"
            >
              ログイン
            </Link>
          )}
        </div>
      )}
      {collapsed ? (
        <div className="flex flex-col items-center gap-1.5">
          {isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={() => setProfileModalOpen(true)}
                className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border text-sm shadow-xs transition hover:ring-2 hover:ring-primary/40 ${
                  isAdmin
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-border bg-surface-raised text-muted-foreground"
                }`}
                title={`${displayName}（${roleLabel}）- クリックしてユーザー名を変更`}
                aria-label={`ログイン中: ${displayName}（${roleLabel}）`}
              >
                <span>{isAdmin ? "👑" : "👤"}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="flex h-7 w-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface-hover hover:text-foreground"
                title="ログアウト"
                aria-label="ログアウト"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                  />
                </svg>
              </button>
            </>
          ) : (
            <Link
              to="/login"
              onClick={onNavigate}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-raised text-muted-foreground transition hover:text-foreground"
              title="ログイン"
            >
              🔑
            </Link>
          )}
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
      )}
      <EditProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  );
}
