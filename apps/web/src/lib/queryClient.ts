import { QueryClient } from '@tanstack/react-query';

/**
 * アプリ全体で共有する QueryClient シングルトン。
 * main.tsx の QueryClientProvider と router context の両方から参照される。
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ルーターの preload と Query の staleTime を協調させるため、
      // デフォルトは短めに設定（各 queryOptions で上書き可能）
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
