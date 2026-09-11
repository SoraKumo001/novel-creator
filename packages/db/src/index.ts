import { type NeonDatabase } from "drizzle-orm/neon-serverless";
import {
  type NodePgDatabase,
  drizzle as nodeDrizzle,
} from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema/index.js";

export * from "./schema/index.js";

/**
 * Cloudflare Hyperdrive binding の最小型定義。
 * @cloudflare/workers-types への依存を避けるため、必要なプロパティのみを定義する。
 */
export interface Hyperdrive {
  connectionString: string;
}

/**
 * データベース接続の共通型。
 * Node.js（node-postgres）と Cloudflare Workers（Neon serverless）の両方で
 * 使用できるように共用型として定義する。
 */
export type Database =
  | NodePgDatabase<typeof schema>
  | NeonDatabase<typeof schema>;

/**
 * 接続文字列からスキーマ名を取得する（デフォルト: "public"）。
 */
export function getSearchPath(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    return url.searchParams.get("schema") ?? "public";
  } catch {
    return "public";
  }
}

/**
 * Node.js 環境向けに PostgreSQL へ接続する。
 * pg.Pool を使用するため、Node.js でのみ動作する。
 * 接続文字列に ?schema=xxx が指定されている場合は search_path を自動設定する。
 */
export function createDb(connectionString: string): Database {
  const searchPath = getSearchPath(connectionString);
  const pool = new Pool({
    connectionString,
    options: `-c search_path=${searchPath},public`,
  });
  return nodeDrizzle(pool, { schema });
}

/**
 * Cloudflare Workers 環境向けに Hyperdrive または PostgreSQL（Supabase 等）へ接続する。
 * nodejs_compat フラグにより Workers 上でも pg.Pool が動作するため、createDb を使用する。
 */
export function createDbForHyperdrive(hyperdrive: Hyperdrive): Database {
  return createDb(hyperdrive.connectionString);
}

export { schema };
