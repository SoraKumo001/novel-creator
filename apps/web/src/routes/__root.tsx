import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { Layout } from '@/components/Layout';
import { ToastProvider } from '@/components/Toast';

export const Route = createRootRoute({
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
