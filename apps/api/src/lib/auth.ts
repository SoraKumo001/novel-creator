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
import { deriveAuthSecret, isMasterConfigured } from "./master-secret.js";

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

/** MASTER_SECRET で設定済みかどうか。 */
export function isAuthConfigured(env: Env): boolean {
  return isMasterConfigured(env);
}

const AUTH_SECRET_MISSING_MESSAGE = "MASTER_SECRET is not configured.";

/**
 * better-auth に渡す secret を解決する。
 * MASTER_SECRET から HKDF 導出値を返す。
 * 未設定時は fail-closed: エラーを投げる。
 * 開発用の暗黙フォールバック secret は存在しない。
 */
export async function resolveAuthSecret(env: Env): Promise<string> {
  if (!env.MASTER_SECRET?.trim()) {
    throw new Error(AUTH_SECRET_MISSING_MESSAGE);
  }
  return deriveAuthSecret(env.MASTER_SECRET);
}

/**
 * 起動時に認証設定を検証する。未設定時は即座に throw する。
 * createApp の先頭で呼び出し、default-deny が無効化されたまま
 * 起動することを防ぐ。
 */
export function assertAuthConfigured(env: Env): void {
  if (isAuthConfigured(env)) {
    return;
  }
  throw new Error(AUTH_SECRET_MISSING_MESSAGE);
}

/**
 * リクエストごとに認証インスタンスを生成するファクトリ。
 * Node 用 pg Pool と Worker 用 Neon HTTP のどちらも受け付ける。
 */
export async function createAuth(env: Env, db: Database | AnyAuthDb) {
  return buildAuth(env, db, await resolveAuthSecret(env));
}

function buildAuth(env: Env, db: Database | AnyAuthDb, secret: string) {
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
    secret,
    trustedOrigins: env.WEB_ORIGIN ? [env.WEB_ORIGIN] : [],
    // role はクライアントから書き込ませない（admin プラグイン経由の管理のみ）。
    user: {
      additionalFields: {},
    },
  });
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;
