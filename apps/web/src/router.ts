import { createRouter } from "@tanstack/react-router";

import { queryClient } from "./lib/queryClient";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  // React Query が staleness を管理するため、ルーターの preload staleTime は 0 に設定
  defaultPreloadStaleTime: 0,
  context: { queryClient },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
