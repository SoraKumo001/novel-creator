import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Layout } from "@/components/Layout.js";
import { ToastProvider } from "@/components/Toast.js";
import { AuthProvider } from "@/context/AuthContext.js";
import { ChatProvider } from "@/context/ChatContext.js";
import { ThemeProvider } from "@/context/ThemeContext.js";
import { fetchAuthSession, fetchAuthStatus } from "@/lib/services/auth.js";

export interface RouterContext {
  queryClient: QueryClient;
}

const PUBLIC_PATHS = ["/login", "/setup"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location }) => {
    const pathname = location.pathname;
    if (isPublicPath(pathname)) {
      return {};
    }
    // バックエンド取得失敗時は fail-closed（ログインへ誘導）
    let status: { initialized: boolean } | null = null;
    try {
      status = await fetchAuthStatus();
    } catch (error) {
      void error;
      throw redirect({ to: "/login", search: { redirect: pathname } });
    }
    if (!status.initialized) {
      throw redirect({ to: "/setup" });
    }
    let userId: string | null = null;
    try {
      const session = await fetchAuthSession();
      userId = session.user?.id ?? null;
    } catch (error) {
      void error;
      throw redirect({ to: "/login", search: { redirect: pathname } });
    }
    if (!userId) {
      throw redirect({ to: "/login", search: { redirect: pathname } });
    }
    return {};
  },
  component: RootComponent,
});

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPublic = isPublicPath(pathname);
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          {isPublic ? (
            <AuthLayout>
              <Outlet />
            </AuthLayout>
          ) : (
            <ChatProvider>
              <Layout>
                <Outlet />
              </Layout>
            </ChatProvider>
          )}
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-10 text-foreground sm:py-16">
      <header className="mb-2 text-center">
        <p className="font-bold text-lg tracking-tight">Novel Creator</p>
        <p className="mt-1 text-muted text-sm">小説づくりのためのアプリです</p>
      </header>
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}
