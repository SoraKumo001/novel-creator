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
  const {
    initialized,
    authLoading,
    isAuthenticated,
    signIn,
    signInWithGoogle,
    googleAuthEnabled,
  } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect: redirectTo } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
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

  async function handleGoogleSignIn(): Promise<void> {
    setFormError(null);
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle(safeRedirect);
    } catch (err) {
      setFormError(toErrorMessage(err));
      setGoogleSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md pt-10">
      <h1 className="font-bold text-2xl text-foreground tracking-tight">
        ログイン
      </h1>
      <p className="mt-1 text-muted text-sm">
        {googleAuthEnabled
          ? "Googleアカウントまたはメールアドレスでログインしてください。"
          : "メールアドレスとパスワードでログインしてください。"}
      </p>
      <Card className="mt-6">
        {googleAuthEnabled && (
          <>
            <Button
              type="button"
              variant="secondary"
              className="w-full justify-center"
              onClick={() => void handleGoogleSignIn()}
              isLoading={googleSubmitting}
              leftIcon={<GoogleIcon />}
            >
              Googleでログイン
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
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus={!googleAuthEnabled}
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
