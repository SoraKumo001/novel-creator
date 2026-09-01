import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          environment: "node",
          include: ["packages/*/test/**/*.test.ts"],
          name: "packages",
        },
      },
      {
        test: {
          environment: "node",
          include: ["apps/api/test/**/*.test.ts"],
          name: "api",
        },
      },
      {
        resolve: {
          alias: {
            "@": path.resolve(import.meta.dirname, "./apps/web/src"),
          },
        },
        test: {
          environment: "jsdom",
          globals: true,
          include: ["apps/web/test/**/*.test.{ts,tsx}"],
          name: "web",
          setupFiles: ["./apps/web/test/setup.ts"],
        },
      },
    ],
  },
});
