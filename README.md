# Novel Creator

## 概要

小説をある程度、自動生成するツール。

- 設定などを VectorDB に保存
- 小説の内容を RDB に保存
- LLM によってプロット、設定、人物情報などを編集できる
- 大まかな章だてを生成 → 個別の内容の概要を作成 → 本文の生成
- 作成した本文から、時系列情報や設定内容を再更新

## アーキテクチャ

ローカル開発環境（Node.js + Docker PostgreSQL + pgvector）で動作し、
Cloudflare（Workers + Hyperdrive + Vectorize）へ移行可能な構成。

LLM プロバイダは OpenAI / Anthropic / Ollama を切り替え可能。

```
┌─────────────────────────────────────────────────────┐
│  apps/web  (React + Vite)                           │
│  TanStack Router / TailwindCSS / MonacoEditor       │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / SSE
┌──────────────────────▼──────────────────────────────┐
│  apps/api  (Hono)                                   │
│  Node.js (@hono/node-server) / Workers (wrangler)   │
├─────────────┬───────────────┬───────────────────────┤
│ packages/db │ packages/llm  │ packages/vector       │
│ Drizzle ORM │ AI SDK        │ VectorStore 抽象化    │
│ PostgreSQL  │ OpenAI/       │ pgvector / Vectorize  │
│ + Hyperdrive│ Anthropic/    │                       │
│             │ Ollama        │                       │
└─────────────┴───────────────┴───────────────────────┘
```

### モノレポ構成

| パッケージ        | 役割                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| `apps/web`        | フロントエンド（React + Vite + TanStack Router + Tailwind + MonacoEditor） |
| `apps/api`        | バックエンド API（Hono、Node.js / Workers 両対応）                         |
| `packages/shared` | 共有型・環境変数スキーマ（zod）                                            |
| `packages/db`     | Drizzle ORM スキーマ・DB 接続（PostgreSQL / Hyperdrive）                   |
| `packages/llm`    | LLM ラッパー（AI SDK、プロバイダ切り替え・プロンプトテンプレート）         |
| `packages/vector` | VectorStore 抽象化（pgvector / Cloudflare Vectorize）                      |

## 技術スタック

### フロントエンド

- React
- TanStack Router（ファイルベースルーティング）
- TailwindCSS
- MonacoEditor

### バックエンド

- Hono による API
- LLM の AI 連携（Vercel AI SDK）
- LLM と Embedding で別プロバイダを指定可能（例: LLM=Ollama / Embedding=OpenAI）
- VectorDB による検索機能（pgvector / Vectorize）
- RDB によるデータ保存（PostgreSQL + Drizzle ORM）

## データモデル

| テーブル     | 内容                                            |
| ------------ | ----------------------------------------------- |
| `novels`     | 小説（タイトル、説明）                          |
| `chapters`   | 章（タイトル、順序、概要）                      |
| `sections`   | 節（章内のシーン、タイトル、順序、概要）        |
| `contents`   | 本文（節に対する本文、文字数）                  |
| `characters` | 人物（名前、説明、特徴、関係性）                |
| `settings`   | 設定（カテゴリ別：世界観、魔法、地理、文化 等） |
| `timelines`  | 時系列情報（イベント、順序、作中時間）          |

## 主な機能

- 小説・章・節・本文の CRUD
- 設定・人物情報の管理（VectorDB に embedding 保存）
- LLM による生成:
  - プロット生成（RAG で既存設定・人物をコンテキストに反映）
  - 章の概要生成 / 節の概要生成
  - 本文生成（SSE ストリーミング）
  - 整合性更新（本文から時系列・設定を自動抽出）
- LLM による編集（人物・設定を自然言語指示で編集）
- 自動フロー（本文生成 → 整合性更新を一連実行）

## セットアップ

### 前提

- Node.js 20+
- pnpm 9+
- Docker（ローカル DB 用）

### 手順

```bash
# 環境変数設定
cp .env.example .env
# .env の LLM_API_KEY 等を編集

# 初期セットアップ（依存インストール + shared ビルド + DB 起動 + マイグレーション）
pnpm setup

# 開発サーバー起動（API: ポート3000 / Web: ポート5173）
pnpm dev:api
pnpm dev:web
```

http://localhost:5173 にアクセス。

## スクリプト

### 初期設定・DB

| コマンド           | 内容                                                                     |
| ------------------ | ------------------------------------------------------------------------ |
| `pnpm setup`       | 初期セットアップ（install + shared ビルド + DB 起動 + マイグレーション） |
| `pnpm setup:db`    | DB 起動 + マイグレーション                                               |
| `pnpm db:up`       | Docker で PostgreSQL 起動                                                |
| `pnpm db:down`     | Docker で PostgreSQL 停止                                                |
| `pnpm db:push`     | DB スキーマ反映                                                          |
| `pnpm db:generate` | マイグレーション生成                                                     |
| `pnpm db:studio`   | Drizzle Studio                                                           |

### 開発

| コマンド          | 内容                                    |
| ----------------- | --------------------------------------- |
| `pnpm dev`        | 全パッケージ並列開発サーバー            |
| `pnpm dev:api`    | API 開発サーバー（Node.js、ポート3000） |
| `pnpm dev:web`    | Web 開発サーバー（Vite、ポート5173）    |
| `pnpm dev:worker` | API 開発サーバー（Wrangler / Workers）  |

### 品質チェック

| コマンド             | 内容                     |
| -------------------- | ------------------------ |
| `pnpm typecheck`     | 全パッケージの型チェック |
| `pnpm lint`          | ESLint                   |
| `pnpm test`          | Vitest テスト実行        |
| `pnpm test:coverage` | テストカバレッジ付き実行 |
| `pnpm build`         | 全パッケージビルド       |
| `pnpm format`        | Prettier でフォーマット  |

### デプロイ

| コマンド          | 内容                                 |
| ----------------- | ------------------------------------ |
| `pnpm deploy:api` | API を Cloudflare Workers にデプロイ |
| `pnpm deploy:web` | Web を Cloudflare Pages にデプロイ   |

## Cloudflare 移行

ローカル環境から Cloudflare（Workers + Hyperdrive + Vectorize）へ移行可能。

### API（Workers）

- `apps/api/wrangler.jsonc` に Hyperdrive・Vectorize binding を定義済み
- `pnpm deploy:api` でデプロイ
- 事前準備:
  1. Hyperdrive 構成を作成（外部 PostgreSQL を接続先に設定）
  2. Vectorize インデックスを作成（`novel-creator`）
  3. `wrangler secret put LLM_API_KEY` で API キー設定

### Web（Pages）

- `apps/web/wrangler.jsonc` に静的アセット設定を定義済み
- `pnpm deploy:web` でデプロイ

### 移行時の切り替えポイント

| レイヤ         | ローカル                     | Cloudflare                       |
| -------------- | ---------------------------- | -------------------------------- |
| RDB            | PostgreSQL（Docker）         | Hyperdrive 経由で外部 PostgreSQL |
| VectorDB       | pgvector                     | Cloudflare Vectorize             |
| API ランタイム | Node.js（@hono/node-server） | Workers（wrangler）              |
| LLM            | 同左（AI SDK で抽象化）      | 同左                             |

`VECTOR_STORE_PROVIDER` を `pgvector` → `vectorize` に変更するだけで VectorStore 実装が切り替わる。
DB 接続は `createDb`（Node.js） / `createDbForHyperdrive`（Workers）で自動選択。

## LLM と Embedding のプロバイダ分離

LLM（テキスト生成）と Embedding（ベクトル生成）で別のプロバイダ・モデルを指定可能。
対応プロバイダ: `openai` / `anthropic` / `ollama` / `google`

```bash
# 例: LLM は OllamaCloud、Embedding は Google を使用
LLM_PROVIDER=ollama
LLM_API_KEY=ollama_...                    # OllamaCloud API キー
LLM_MODEL=glm-5.2                         # プレフィックスなしのモデル名
LLM_BASE_URL=https://ollama.com/v1        # OllamaCloud の OpenAI 互換エンドポイント

EMBEDDING_PROVIDER=google
EMBEDDING_API_KEY=AIza...                 # Google API キー
EMBEDDING_MODEL=gemini-embedding-001      # text-embedding-004 は廃止済み
```

```bash
# 例: LLM は OpenAI、Embedding は Ollama を使用
LLM_PROVIDER=openai
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini

EMBEDDING_PROVIDER=ollama
EMBEDDING_BASE_URL=http://localhost:11434/v1
EMBEDDING_MODEL=nomic-embed-text
```

`EMBEDDING_*` 環境変数が未設定の場合は `LLM_*` の設定をフォールバック使用する。

### プロバイダ別の注意点

| プロバイダ  | LLM | Embedding                     | 備考                                                       |
| ----------- | --- | ----------------------------- | ---------------------------------------------------------- |
| `openai`    | ✅  | ✅                            | 標準                                                       |
| `anthropic` | ✅  | ❌（OpenAI にフォールバック） | Embedding 非対応                                           |
| `ollama`    | ✅  | ✅                            | OllamaCloud は `LLM_BASE_URL=https://ollama.com/v1` を指定 |
| `google`    | ✅  | ✅                            | `gemini-embedding-001` または `gemini-embedding-2` を推奨  |
