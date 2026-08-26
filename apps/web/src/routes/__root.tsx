import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import type { QueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { ToastProvider } from '@/components/Toast';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ToastProvider>
      <Layout>
        <Outlet />
      </Layout>
      <TanStackRouterDevtools />
    </ToastProvider>
  );
}
