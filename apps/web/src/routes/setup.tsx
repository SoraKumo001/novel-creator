import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button.js";
import { Card } from "@/components/Card.js";
import { Input } from "@/components/Input.js";
import { Loading } from "@/components/Loading.js";
import { useAuth } from "@/hooks/useAuth.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import { RoutePending } from "@/routes/-pending.js";

export const Route = createFileRoute("/setup")({
  pendingComponent: RoutePending,
  component: SetupPage,
});

export function SetupPage() {
  const {
    initialized,
    authLoading,
    setupAdmin,
    signInWithGoogle,
    googleAuthEnabled,
  } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && initialized === true) {
      void navigate({ to: "/login" });
    }
  }, [authLoading, initialized, navigate]);

  if (authLoading) {
    return <Loading message="確認中..." />;
  }

  if (initialized === true) {
    return <Loading message="移動中..." />;
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !email.trim() || !password) {
      setFormError("名前・メールアドレス・パスワードを入力してください");
      return;
    }
    setSubmitting(true);
    try {
      await setupAdmin(email.trim(), password, name.trim());
      toast.success("初期管理者を作成しました");
      await navigate({ to: "/" });
    } catch (err) {
      setFormError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignUp(): Promise<void> {
    setFormError(null);
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle("/novels");
    } catch (err) {
      setFormError(toErrorMessage(err));
      setGoogleSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md pt-10">
      <h1 className="font-bold text-2xl text-foreground tracking-tight">
        初期セットアップ
      </h1>
      <p className="mt-1 text-muted text-sm">
        {googleAuthEnabled
          ? "Googleアカウントまたはメールアドレスで最初の管理者を作成してください。"
          : "最初の管理者アカウントを作成してください。"}
      </p>
      <Card className="mt-6">
        {googleAuthEnabled && (
          <>
            <Button
              type="button"
              variant="secondary"
              className="w-full justify-center"
              onClick={() => void handleGoogleSignUp()}
              isLoading={googleSubmitting}
              leftIcon={<GoogleIcon />}
            >
              Googleアカウントで初期管理者を登録
            </Button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-border border-t" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-surface px-2 text-muted">または</span>
              </div>
            </div>
          </>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="名前"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 管理者"
            autoComplete="name"
            autoFocus={!googleAuthEnabled}
          />
          <Input
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            autoComplete="email"
          />
          <Input
            label="パスワード"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8文字以上"
            autoComplete="new-password"
          />
          {formError && <p className="text-danger text-sm">{formError}</p>}
          <Button type="submit" isLoading={submitting}>
            管理者を作成する
          </Button>
        </form>
      </Card>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}
