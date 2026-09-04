import { user } from "@novel-creator/db";
import { count } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppContext } from "./context.js";
import { createAuth } from "./lib/auth.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import { logger } from "./middleware/logger.js";
import { registerAuthStatusRoute } from "./routes/auth.js";
import backupRouter from "./routes/backup.js";
import chaptersRouter from "./routes/chapters.js";
import charactersRouter from "./routes/characters.js";
import chatRouter from "./routes/chat.js";
import contentsRouter from "./routes/contents.js";
import { customPromptsRouter } from "./routes/custom-prompts.js";
import embeddingConfigsRouter from "./routes/embedding-configs.js";
import foreshadowingsRouter from "./routes/foreshadowings.js";
import historiesRouter from "./routes/histories.js";
import llmConfigsRouter from "./routes/llm-configs.js";
import llmInstructionsRouter from "./routes/llm-instructions.js";
import novelsRouter from "./routes/novels.js";
import sectionsRouter from "./routes/sections.js";
import settingsRouter from "./routes/settings.js";
import { registerSetupRoute } from "./routes/setup.js";
import timelinesRouter from "./routes/timelines.js";
import usersRouter from "./routes/users.js";
import vectorRouter from "./routes/vector.js";

// API ルーター定義
export const api = new Hono<AppContext>()
  .route("/novels", novelsRouter)
  .route("/chapters", chaptersRouter)
  .route("/sections", sectionsRouter)
  .route("/contents", contentsRouter)
  .route("/characters", charactersRouter)
  .route("/settings", settingsRouter)
  .route("/timelines", timelinesRouter)
  .route("/foreshadowings", foreshadowingsRouter)
  .route("/llm-instructions", llmInstructionsRouter)
  .route("/llm-configs", llmConfigsRouter)
  .route("/embedding-configs", embeddingConfigsRouter)
  .route("/vector", vectorRouter)
  .route("/chat", chatRouter)
  .route("/backup", backupRouter)
  .route("/histories", historiesRouter)
  .route("/custom-prompts", customPromptsRouter)
  .route("/users", usersRouter);

// Hono RPC 用のアプリケーション型定義
export type ApiType = typeof api;
export type AppType = ApiType;

/**
 * Hono アプリケーションを構築する。
 * Node.js（index.ts）と Cloudflare Workers（worker.ts）の両方から利用する。
 */
export function createApp(context: AppContext["Variables"]) {
  const app = new Hono<AppContext>();

  // ミドルウェア
  app.use(
    "*",
    cors({
      allowHeaders: ["Content-Type", "Authorization", "Cookie"],
      credentials: true,
      exposeHeaders: ["Content-Type", "Set-Cookie"],
      origin: [context.env.WEB_ORIGIN],
    })
  );
  app.use("*", logger);
  app.use("*", async (c, next) => {
    c.set("env", context.env);
    c.set("db", context.db);
    c.set("llm", context.llm);
    c.set("embedding", context.embedding);
    c.set("vectorStore", context.vectorStore);
    await next();
  });
  app.onError(errorHandler);

  // /api/auth 配下はメインアプリに直接登録する。
  // `.route()` でサブアプリをマウントすると以降の `/api/auth/**` が
  // マッチしなくなるため、先に具体的な setup・status を登録する。
  registerSetupRoute(app);
  registerAuthStatusRoute(app);

  // better-auth への委譲はミドルウェア形式で登録する。
  // `app.on(..., "/api/auth/**")` はルート数増加時にマッチしなくなる実測があるため
  // `app.use("/api/auth/*")` を使う（`*` は複数セグメントにマッチすることを確認済み）。
  // /status・/setup は上で先に登録済みのためそちらが優先される。
  // 全メソッド対応のため将来の OAuth/Admin 系エンドポイントも透過する。
  // OPTIONS プリフライトは先頭の cors が応答するためここには届かない。
  app.use("/api/auth/*", async (c) => {
    const url = new URL(c.req.url);
    if (url.pathname.endsWith("/sign-up/email") && c.req.method === "POST") {
      try {
        const [{ value }] = await c
          .get("db")
          .select({ value: count() })
          .from(user);
        if (value > 0) {
          return c.json(
            { error: { code: "FORBIDDEN", message: "Sign-up is disabled" } },
            403
          );
        }
      } catch {
        // 件数取得に失敗した場合は handler 側の判定に任せる。
      }
    }
    const auth = createAuth(c.get("env"), c.get("db"));
    return auth.handler(c.req.raw);
  });

  // /api 配下は default-deny で認証を要求する（/api/auth/** のみ除外）。
  // use は登録順序によらずマッチするため、パスで明示的に除外する。
  app.use("/api/*", async (c, next) => {
    if (c.req.path === "/api/auth" || c.req.path.startsWith("/api/auth/")) {
      await next();
      return;
    }
    return requireAuth(c, next);
  });

  // ルーター登録
  app.route("/api", api);
  app.get("/health", (c) => c.json({ status: "ok" as const }));

  return app;
}
