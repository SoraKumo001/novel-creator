import { useEffect, useState } from "react";
import { Button } from "@/components/Button.js";
import { Card } from "@/components/Card.js";
import { useAuth } from "@/hooks/useAuth.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";

export function AccountSection() {
  const { user, isAdmin, updateProfile } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.name ?? "");
  }, [user?.name]);

  const hasChanged = name.trim() !== (user?.name ?? "");

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("ユーザー名を入力してください。");
      return;
    }
    if (trimmed.length > 50) {
      setError("ユーザー名は50文字以内で入力してください。");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateProfile(trimmed);
      toast.success("ユーザー名を更新しました");
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="font-semibold text-foreground text-lg">
          アカウント情報
        </h2>
        <p className="mt-1 text-muted-foreground text-xs">
          現在ログインしているアカウントの基本情報と表示設定です。
        </p>

        <div className="mt-6 divide-y divide-border">
          {/* メールアドレス */}
          <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="font-medium text-foreground text-sm">
              メールアドレス
            </dt>
            <dd className="mt-1 text-foreground-secondary text-sm sm:col-span-2 sm:mt-0">
              <span className="font-mono">{user?.email || "—"}</span>
              <span className="ml-2 text-muted text-xs">（変更不可）</span>
            </dd>
          </div>

          {/* 権限 / ロール */}
          <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="font-medium text-foreground text-sm">権限</dt>
            <dd className="mt-1 flex items-center gap-2 sm:col-span-2 sm:mt-0">
              <span
                className={`inline-flex items-center rounded border px-2 py-0.5 font-semibold text-xs ${
                  isAdmin
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-border bg-surface-hover text-muted-foreground"
                }`}
              >
                {isAdmin ? "👑 管理者" : "👤 一般ユーザー"}
              </span>
              <span className="text-muted text-xs">
                {isAdmin
                  ? "システム全体の設定やユーザー管理が可能です。"
                  : "小説の閲覧・執筆・相談が可能です。"}
              </span>
            </dd>
          </div>

          {/* ユーザー名（表示名）フォーム */}
          <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="font-medium text-foreground text-sm">
              表示名（ユーザー名）
            </dt>
            <dd className="mt-1 sm:col-span-2 sm:mt-0">
              <form onSubmit={handleSubmit} className="max-w-md space-y-3">
                {error && (
                  <div className="rounded-md border border-danger-border bg-danger-subtle p-2.5 text-danger-subtle-fg text-xs">
                    {error}
                  </div>
                )}
                <div>
                  <input
                    id="account-display-name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="例: 山田 太郎"
                    maxLength={50}
                    disabled={saving}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-foreground text-sm placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>サイドバーやメンバー一覧に表示される名前です</span>
                    <span>{name.trim().length} / 50</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={saving || !hasChanged || !name.trim()}
                  >
                    {saving ? "保存中..." : "変更を保存"}
                  </Button>
                  {hasChanged && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setName(user?.name ?? "");
                        setError(null);
                      }}
                      disabled={saving}
                    >
                      リセット
                    </Button>
                  )}
                </div>
              </form>
            </dd>
          </div>
        </div>
      </Card>
    </div>
  );
}
