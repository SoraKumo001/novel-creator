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
 * リクエストごとに認証インスタンスを生成するファクトリ。
 * Node 用 pg Pool と Worker 用 Neon HTTP のどちらも受け付ける。
 * BETTER_AUTH_SECRET は secrets 運用前提のため、未設定時は開発用の
 * フォールバックで起動だけ可能にし、ミドルウェア側で素通り判定する。
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
    secret: env.BETTER_AUTH_SECRET ?? "dev-insecure-secret-change-me",
    trustedOrigins: [env.WEB_ORIGIN],
    // role はクライアントから書き込ませない（admin プラグイン経由の管理のみ）。
    user: {
      additionalFields: {},
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
