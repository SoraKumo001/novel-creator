# MCP サーバー仕様書

novel-creator の MCP (Model Context Protocol) サーバーの仕様・運用メモ。
実装本体: `apps/api/src/mcp/`（server / tools / resources / prompts / section-guard）。

## 概要

- 小説執筆支援ドメイン（小説・章・節・人物・設定・伏線・年表・履歴参照・知識検索）を MCP 経由で公開する。
- トランスポートは Streamable HTTP のみ（stdio は廃止、旧 SSE 系は削除済み）。
- 認証は Web 発行キー（`mcp_api_keys`）による Bearer 検証のみ。不一致・未提示時は 401（fail-closed）。

## 起動方法

### HTTP（Streamable HTTP のみ）

- `POST /api/mcp` — 現行エンドポイント。ステートレス運用（リクエストごとにサーバー生成）。
- `GET /`・`DELETE /`（＝ `GET /api/mcp`・`DELETE /api/mcp`）は **405** を返す。
- 旧 `GET /api/mcp/sse`＋`POST /api/mcp/messages`（SSE ブリッジ）は削除済み。

curl 例（initialize）:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0.0.0"}}}'
```

クライアント設定例（`.mcp.json` に済み）:

```json
{
  "mcpServers": {
    "novel-creator": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

## 認証

- Web 発行キーのみを検証する（`verifyMcpKey` で合致しなければ **401**、fail-closed）。env によるマスターキーは廃止済み。
- ヘッダは `Authorization: Bearer <KEY>` または `x-api-key`。
- Web 発行キー: 初回は管理者が設定画面の「MCP APIキー」タブから発行する（`GET/POST /api/mcp-keys`、`DELETE /api/mcp-keys/:id`、いずれも admin 限定）。トークン形式は `mcp_` + 32byte base64url。平文は発行応答でのみ返し、DB には SHA-256 ハッシュ＋ enc:v1 暗号文を保管する。一覧表示のマスクは llm-configs と同型でサーバ内復号して生成する。

## Tools（50）

実装: `apps/api/src/mcp/tools.ts`。

- 小説: `list_novels`, `get_novel`, `create_novel`, `update_novel`, `delete_novel`
- プロット: `get_plot_outline`, `save_plot_outline_markdown`
- 章: `create_chapter`, `update_chapter`, `delete_chapter`
- 節: `create_section`, `update_section`, `delete_section`, `get_section_content`, `save_section_content`
- 人物: `list_characters`, `get_character`, `create_character`, `update_character`, `delete_character`, `save_characters_markdown`
- 設定: `list_settings`, `get_setting`, `create_setting`, `update_setting`, `delete_setting`, `save_settings_markdown`
- 伏線: `list_foreshadowings`, `create_foreshadowing`, `update_foreshadowing`, `delete_foreshadowing`
- 年表: `list_timelines`, `create_timeline_event`, `update_timeline_event`, `delete_timeline_event`
- 章・節の単体取得: `get_chapter`（配下節メタ含む・本文なし）、`get_section`（メタのみ・本文なし。`get_section_content` と用途分離）
- 履歴参照: `list_histories`、`get_history`（いずれも参照専用。記録・復元系は未提供）
- 知識検索: `search_novel_knowledge`
- 一括読み書き: `batch_get_section_contents`、`batch_save_section_contents`、`batch_create_foreshadowings`、`batch_update_foreshadowings`、`batch_create_timeline_events`、`batch_update_timeline_events`（いずれも最大20件・部分成功形式 `{ ok, ng }` で返却）
- 伏線・年表Markdown: `get_foreshadowings_markdown`、`save_foreshadowings_markdown`、`get_timelines_markdown`、`save_timelines_markdown`

## Resources（5）

実装: `apps/api/src/mcp/resources.ts`。

| 名称 | URI |
|---|---|
| `novel-summary` | `novel://{novelId}` |
| `novel-outline` | `novel://{novelId}/outline` |
| `novel-characters` | `novel://{novelId}/characters` |
| `novel-settings` | `novel://{novelId}/settings` |
| `section-content` | `novel://{novelId}/section/{sectionId}` |

## Prompts（3）

実装: `apps/api/src/mcp/prompts.ts`。

- `draft_section` — 節本文の初稿執筆プロンプト（novelId / sectionId / instructions?）。
- `review_consistency` — 設定・人物・伏線との整合性レビュープロンプト（novelId / sectionId）。
- `brainstorm_plot` — 未回収伏線をもとにした展開ブレスト（novelId / focusTopic?）。

## section-guard による novelId 照合

- 実装: `apps/api/src/mcp/section-guard.ts` の `assertSectionBelongsToNovel(services, novelId, sectionId)`。
- `section → chapter` の2段引きで `chapter.novelId` と指定 `novelId` を照合する。
- 不一致時は `NotFoundError("Section", sectionId)` を投げ、error-handler の 404 変換に載せる（別小説の節 ID 推測による横断参照を 404 で遮断）。
- 適用箇所: `section-content` リソース、`draft_section` / `review_consistency` プロンプト。

## Workers 注意

- HTTP 系は `WebStandardStreamableHTTPServerTransport`（Web 標準 Request/Response）のため Node.js / Workers 双方で動作する。
- ステートレス（`sessionIdGenerator: undefined`）にしているのは、Workers のリクエスト間メモリ共有なし・複数インスタンス分散でも正しく動かすため。

## カバレッジ外（今後の検討事項）

以下は現状 MCP 未提供。追加は本仕様書の対象外とし、要否・優先度は別途検討する。

- histories の記録・復元系、backup（エクスポート/復元）、chat（対話セッション）
- vector（再インデックス等の運用系）、llm-config / embedding-config（プロバイダ設定）
- custom-prompt、analysis 系ドメイン
