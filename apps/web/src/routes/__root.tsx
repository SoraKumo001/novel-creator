import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout.js';
import { ToastProvider } from '@/components/Toast.js';
import { ChatProvider } from '@/context/ChatContext.js';
import { ThemeProvider } from '@/context/ThemeContext.js';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ChatProvider>
          <Layout>
            <Outlet />
          </Layout>
        </ChatProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
