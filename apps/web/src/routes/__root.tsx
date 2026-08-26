import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import type { QueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout.js';
import { ToastProvider } from '@/components/Toast.js';
import { ChatProvider } from '@/context/ChatContext.js';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ToastProvider>
      <ChatProvider>
        <Layout>
          <Outlet />
        </Layout>
        <TanStackRouterDevtools />
      </ChatProvider>
    </ToastProvider>
  );
}
