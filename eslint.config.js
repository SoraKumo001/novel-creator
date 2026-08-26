import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/drizzle.config.ts',
      '**/drizzle/**',
      '**/packages/proto/src/gen/**',
      '**/*.log',
      '**/storybook-static/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
    languageOptions: {
      parserOptions: {
        projectService: {
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 32,
          allowDefaultProject: [
            'vitest.config.ts',
            'vitest.workspace.ts',
            'apps/web/vitest.config.ts',
            'apps/web/test/setup.ts',
            'apps/web/test/hooks.test.tsx',
            'apps/web/test/chat.test.tsx',
            'apps/web/test/markdown-text.test.tsx',
            'apps/web/.storybook/main.ts',
            'apps/web/.storybook/preview.ts',
            'apps/api/test/routes.test.ts',
            'apps/api/test/chat.test.ts',
            'apps/api/test/backup.test.ts',
            'apps/api/test/connect.test.ts',
            'apps/api/src/worker.ts',
            'packages/llm/test/prompts.test.ts',
            'packages/vector/test/types.test.ts',
            'packages/shared/test/markdown.test.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
