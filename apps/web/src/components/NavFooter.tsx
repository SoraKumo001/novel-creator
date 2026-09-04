import { Link, useNavigate } from "@tanstack/react-router";
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
  const { user, isAuthenticated, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

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

  return (
    <div className="space-y-2 border-border border-t p-2">
      {!collapsed && (
        <div className="rounded-lg border border-border bg-surface-raised px-2.5 py-2">
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground text-xs">
                  {user?.name || user?.email || "ログイン中"}
                </p>
                {user?.name && (
                  <p className="truncate text-[11px] text-muted">
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
  );
}
