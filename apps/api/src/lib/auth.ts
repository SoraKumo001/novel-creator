import {
  account,
  type Database,
  schema,
  session,
  user,
  verification,
} from "@novel-creator/db";
import type { Env } from "@novel-creator/shared";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * better-auth に渡す認証テーブル群。
 */
const authTables = { account, session, user, verification };
type AuthTables = typeof authTables;

/**
 * Node.js 用の Drizzle 型（pg Pool 系）。
 * Worker 用の Neon HTTP 系と型分離し、どちらも drizzleAdapter(pg) に渡せる。
 */
export type NodeAuthDb = NodePgDatabase<typeof schema>;
/** Cloudflare Workers 用の Drizzle 型（Neon HTTP 系）。 */
export type WorkerAuthDb =
  | NeonDatabase<typeof schema>
  | NeonHttpDatabase<AuthTables>;
export type AnyAuthDb = NodeAuthDb | WorkerAuthDb;

/** BETTER_AUTH_SECRET が secrets 運用で設定済みかどうか。 */
export function isAuthConfigured(env: Env): boolean {
  return !!env.BETTER_AUTH_SECRET;
}

/**
 * テスト専用のフォールバック secret。
 * ALLOW_INSECURE_AUTH_FOR_TESTS=true の場合にのみ使用される。
 * 本番・開発の通常起動では絶対に使ってはならない。
 */
export const TEST_ONLY_AUTH_SECRET =
  "test-only-insecure-secret-do-not-use-in-production";

/** 明示的なテスト用バイパスフラグが有効かどうか。 */
export function isInsecureAuthBypassAllowed(): boolean {
  const holder = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  return holder.process?.env?.ALLOW_INSECURE_AUTH_FOR_TESTS === "true";
}

const AUTH_SECRET_MISSING_MESSAGE =
  "BETTER_AUTH_SECRET is not configured. Set BETTER_AUTH_SECRET via secrets management before starting the API. For automated tests only, set ALLOW_INSECURE_AUTH_FOR_TESTS=true to allow startup without a secret.";

/**
 * better-auth に渡す secret を解決する。
 * 未設定時は fail-closed: 明示的なテストバイパスが無い限りエラーを投げる。
 * 開発用の暗黙フォールバック secret は存在しない。
 */
export function resolveAuthSecret(env: Env): string {
  if (env.BETTER_AUTH_SECRET) {
    return env.BETTER_AUTH_SECRET;
  }
  if (isInsecureAuthBypassAllowed()) {
    return TEST_ONLY_AUTH_SECRET;
  }
  throw new Error(AUTH_SECRET_MISSING_MESSAGE);
}

/**
 * 起動時に認証設定を検証する。未設定時は即座に throw する。
 * createApp の先頭で呼び出し、default-deny が無効化されたまま
 * 起動することを防ぐ。
 */
export function assertAuthConfigured(env: Env): void {
  resolveAuthSecret(env);
}

/**
 * リクエストごとに認証インスタンスを生成するファクトリ。
 * Node 用 pg Pool と Worker 用 Neon HTTP のどちらも受け付ける。
 * BETTER_AUTH_SECRET は secrets 運用前提のため、未設定時は
 * 明示的なテストバイパスが無い限りエラーを投げる（fail-closed）。
 */
export function createAuth(env: Env, db: Database | AnyAuthDb) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: authTables,
    }),
    emailAndPassword: {
      // 初期セットアップ後は routes/auth.ts 側で sign-up を 403 に抑止する。
      // disableSignUp 自体は false のままにし、COUNT(users)==0 の初回のみ許可する。
      disableSignUp: false,
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [admin()],
    secret: resolveAuthSecret(env),
    trustedOrigins: [env.WEB_ORIGIN],
    // role はクライアントから書き込ませない（admin プラグイン経由の管理のみ）。
    user: {
      additionalFields: {},
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
