# Project Guidelines & Code Standards

This repository uses **Ultracite** with **Biome** (`biome.jsonc`) for zero-config linting and formatting.

## Commands
- Check: `pnpm lint:check` (or `pnpm ultracite check`)
- Auto-Fix: `pnpm lint:fix` (or `pnpm ultracite fix`)
- Diagnostics: `pnpm ultracite doctor`

## Code Standards
Follow the Ultracite code standards when editing or generating code:
- **Formatting**: Adhere to existing repository formatting (`biome.jsonc`).
- **Type Safety**: Prefer explicit types and `unknown` over `any`. Use `as const` and TypeScript narrowing.
- **Async**: Always `await` promises in async functions. Prefer `async/await` over promise chains.
- **Cleanliness**: Remove `console.log`, `debugger`, and unused variables before completing tasks.
- **React**: Use function components, hooks at top level, proper dependency arrays, and semantic accessible HTML.
- **Validation**: Run `pnpm lint:check` or `pnpm lint:fix` to ensure changes conform to repository rules.
