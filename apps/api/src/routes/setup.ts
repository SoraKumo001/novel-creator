import { zValidator } from "@hono/zod-validator";
import { user } from "@novel-creator/db";
import { count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { AppContext } from "../context.js";
import { createAuth } from "../lib/auth.js";

/**
 * 初期管理者セットアップ用スキーマ。
 * role フィールドは受け付けない（zod 既定で strip され無視される）。
 */
const setupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
});

type ApiErrorLike = {
  message?: string;
  status?: number;
  statusCode?: number;
};

/**
 * POST /api/auth/setup は COUNT(users)==0 の初回のみ admin を作成する。
 * 2 回目以降は 404 を返す（以後 sign-up も app.ts 側の委譲で抑止する）。
 * メインアプリに直接登録する。`.route()` マウントは
 * `/api/auth/**` 委譲のマッチを壊すため使わない。
 */
export function registerSetupRoute(app: Hono<AppContext>) {
  app.post("/api/auth/setup", zValidator("json", setupSchema), async (c) => {
    const db = c.get("db");
    const [{ value }] = await db.select({ value: count() }).from(user);
    if (value > 0) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Not found" } },
        404
      );
    }
    const { email, name, password } = c.req.valid("json");
    const auth = createAuth(c.get("env"), db);
    try {
      // セッション Cookie を受け取るため returnHeaders 付きで呼ぶ。
      // Set-Cookie を転送しないとブラウザにセッションが残らず、直後の画面遷移で
      // 未ログイン扱い→/login→再遷移のリダイレクトループになる。
      const { headers, response } = await auth.api.signUpEmail({
        body: { email, name, password },
        headers: c.req.raw.headers,
        returnHeaders: true,
      });
      await db
        .update(user)
        .set({ role: "admin" })
        .where(eq(user.id, response.user.id));
      const outHeaders = new Headers({ "Content-Type": "application/json" });
      for (const cookie of headers.getSetCookie()) {
        outHeaders.append("Set-Cookie", cookie);
      }
      return new Response(
        JSON.stringify({
          user: {
            email: response.user.email,
            id: response.user.id,
            name: response.user.name,
            role: "admin",
          },
        }),
        { headers: outHeaders, status: 201 }
      );
    } catch (err) {
      // signUpEmail が user 作成後に失敗すると認証情報なしの孤立行が残り、
      // 後の /setup 再試行（件数>0で404）やログイン（credentialなしで401）が
      // 詰まるため後始末する。後始末の失敗は元のエラーを優先して無視する。
      try {
        await db.delete(user).where(eq(user.email, email));
      } catch {
        // 元のエラーを優先する
      }
      const apiErr = err as ApiErrorLike;
      const status = apiErr.statusCode ?? apiErr.status ?? 400;
      return c.json(
        {
          error: {
            code: status === 422 ? "VALIDATION_ERROR" : "VALIDATION_ERROR",
            message: apiErr.message ?? "Setup failed",
          },
        },
        status as 400
      );
    }
  });
}
