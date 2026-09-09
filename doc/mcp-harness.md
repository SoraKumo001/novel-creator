# MCP 外部ハーネス操作手順

1. `initialize` → `tools/list` → `tools/call` → `resources/read` → `prompts/get` の順に呼ぶ（`POST /api/mcp` のみ。GET/DELETE は 405）。
2. 認証は `Authorization: Bearer <mcp_キー>`（または `x-api-key`）。不一致・未提示は 401。
3. ブラウザ経由は `Origin: <WEB_ORIGIN>` を送る（不一致は 403）。非ブラウザは Origin 不要。
4. 破壊的 `delete_*` 7 ツールは `arguments.confirm: true` が必須（なしは 400 `CONFIRMATION_REQUIRED`）。
5. スコープキー（小説紐付き）は当該小説のみ可。不一致は 404（403 にしない）。
6. 429（`RATE_LIMITED` / `CONCURRENT_LIMIT`）は `Retry-After` 秒後に再試行する。
7. 503（`CIRCUIT_OPEN`）は 30s 後に再試行する。504（`TIMEOUT`）は冪等な読み取りのみ再試行する。
8. `params._meta.traceparent` を付けると監査ログにそのまま載る（未指定時の生成なし）。
9. 疎通確認: `GET /api/mcp/health`（認証不要）、`GET /healthz`（DB 疎通）。
10. 目視確認: `pnpm --filter @novel-creator/api mcp:inspect`。契約回帰: `pnpm --filter @novel-creator/api test:mcp`。
