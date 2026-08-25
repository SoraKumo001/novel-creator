import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'packages',
          include: ['packages/*/test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'api',
          include: ['apps/api/test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'web',
          include: ['apps/web/test/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./apps/web/test/setup.ts'],
        },
        resolve: {
          alias: {
            '@': path.resolve(import.meta.dirname, './apps/web/src'),
          },
        },
      },
    ],
  },
});
