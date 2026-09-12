import { user } from "@novel-creator/db";
import { count } from "drizzle-orm";
import { Hono } from "hono";

import type { AppContext } from "../context.js";

/**
 * GET /api/auth/status は初期化済みかどうかだけを返す（件数は返さない）。
 * メインアプリに直接登録すること。`.route()` でサブアプリをマウントすると
 * 以降の `/api/auth/**` がマッチしなくなる（Hono のマージ挙動）。
 */
export function registerAuthStatusRoute(app: Hono<AppContext>) {
  app.get("/api/auth/status", async (c) => {
    const env = c.get("env");
    const googleAuthEnabled = Boolean(
      env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim()
    );
    try {
      const [{ value }] = await c
        .get("db")
        .select({ value: count() })
        .from(user);
      return c.json({ googleAuthEnabled, initialized: value > 0 });
    } catch {
      // 認証テーブル未マイグレーション時は未初期化扱いにする。
      return c.json({ googleAuthEnabled, initialized: false });
    }
  });
}
