import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button.js";
import { Card } from "@/components/Card.js";
import { Input } from "@/components/Input.js";
import { Loading } from "@/components/Loading.js";
import { useAuth } from "@/hooks/useAuth.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import { RoutePending } from "@/routes/-pending.js";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  pendingComponent: RoutePending,
  component: LoginPage,
});

export function LoginPage() {
  const { initialized, authLoading, isAuthenticated, signIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect: redirectTo } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const safeRedirect =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/novels";

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (initialized === false) {
      void navigate({ to: "/setup" });
    } else if (isAuthenticated) {
      router.history.push(safeRedirect);
    }
  }, [
    authLoading,
    initialized,
    isAuthenticated,
    navigate,
    router,
    safeRedirect,
  ]);

  if (authLoading) {
    return <Loading message="確認中..." />;
  }

  if (initialized === false || isAuthenticated) {
    return <Loading message="移動中..." />;
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);
    if (!email.trim() || !password) {
      setFormError("メールアドレスとパスワードを入力してください");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      toast.success("ログインしました");
      router.history.push(safeRedirect);
    } catch (err) {
      setFormError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md pt-10">
      <h1 className="font-bold text-2xl text-foreground tracking-tight">
        ログイン
      </h1>
      <p className="mt-1 text-muted text-sm">
        メールアドレスとパスワードでログインしてください。
      </p>
      <Card className="mt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
          />
          <Input
            label="パスワード"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {formError && <p className="text-danger text-sm">{formError}</p>}
          <Button type="submit" isLoading={submitting}>
            ログイン
          </Button>
        </form>
      </Card>
    </div>
  );
}
