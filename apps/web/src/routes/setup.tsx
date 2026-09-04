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
  const { initialized, authLoading, setupAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="mx-auto max-w-md pt-10">
      <h1 className="font-bold text-2xl text-foreground tracking-tight">
        初期セットアップ
      </h1>
      <p className="mt-1 text-muted text-sm">
        最初の管理者アカウントを作成してください。
      </p>
      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="名前"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 管理者"
            autoComplete="name"
            autoFocus
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
