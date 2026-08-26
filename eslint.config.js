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
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 16,
          allowDefaultProject: [
            'vitest.config.ts',
            'vitest.workspace.ts',
            'apps/web/vitest.config.ts',
            'apps/web/test/setup.ts',
            'apps/web/test/hooks.test.tsx',
            'apps/web/.storybook/main.ts',
            'apps/web/.storybook/preview.ts',
            'apps/api/test/routes.test.ts',
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
