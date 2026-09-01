import {
  type NeonDatabase,
  drizzle as neonDrizzle,
} from "drizzle-orm/neon-serverless";
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
 * Node.js 環境向けに PostgreSQL へ接続する。
 * pg.Pool を使用するため、Node.js でのみ動作する。
 */
export function createDb(connectionString: string): Database {
  const pool = new Pool({ connectionString });
  return nodeDrizzle(pool, { schema });
}

/**
 * Cloudflare Workers 環境向けに Hyperdrive 経由で PostgreSQL へ接続する。
 * @neondatabase/serverless を使用するため、nodejs_compat フラグで動作する。
 */
export function createDbForHyperdrive(hyperdrive: Hyperdrive): Database {
  return neonDrizzle(hyperdrive.connectionString, { schema });
}

export { schema };
