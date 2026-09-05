import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import type { AppContext } from "../src/context.js";
import {
  assertAuthConfigured,
  createAuth,
  isAuthConfigured,
  resolveAuthSecret,
} from "../src/lib/auth.js";
import { deriveAuthSecret } from "../src/lib/master-secret.js";
import { assertNovelAccess, requireAuth } from "../src/middleware/auth.js";

const TEST_MASTER_SECRET = "test-master-secret-0123456789";

function masterEnv() {
  return {
    MASTER_SECRET: TEST_MASTER_SECRET,
  } as AppContext["Variables"]["env"];
}

describe("auth fail-closed (MASTER_SECRET)", () => {
  it("isAuthConfigured は MASTER 有無のみで判定すること", () => {
    expect(isAuthConfigured(masterEnv())).toBe(true);
    expect(isAuthConfigured({} as AppContext["Variables"]["env"])).toBe(false);
  });

  it("resolveAuthSecret は MASTER から導出した値を返すこと", async () => {
    const expected = await deriveAuthSecret(TEST_MASTER_SECRET);
    await expect(resolveAuthSecret(masterEnv())).resolves.toBe(expected);
  });

  it("resolveAuthSecret は未設定で throw すること", async () => {
    await expect(
      resolveAuthSecret({} as AppContext["Variables"]["env"])
    ).rejects.toThrow(/MASTER_SECRET is not configured/);
  });

  it("createAuth は未設定で throw すること", async () => {
    await expect(
      createAuth({} as AppContext["Variables"]["env"], {} as never)
    ).rejects.toThrow(/MASTER_SECRET is not configured/);
  });

  it("assertAuthConfigured は未設定で throw すること", () => {
    expect(() =>
      assertAuthConfigured({} as AppContext["Variables"]["env"])
    ).toThrow(/MASTER_SECRET is not configured/);
  });

  it("createApp は未設定で起動時 throw すること", () => {
    const context = {
      db: {},
      embedding: {},
      env: {},
      llm: {},
      services: {},
      vectorStore: {},
    } as never;
    expect(() => createApp(context)).toThrow(/MASTER_SECRET is not configured/);
  });

  it("requireAuth は未設定で素通りせず 500 を返すこと", async () => {
    const app = new Hono<AppContext>();
    app.use("*", async (c, next) => {
      c.set("env", {} as never);
      c.set("db", {} as never);
      await next();
    });
    app.use("/api/*", requireAuth);
    app.get("/api/novels", (c) => c.json([]));
    const res = await app.request("/api/novels");
    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("AUTH_NOT_CONFIGURED");
  });

  it("assertNovelAccess は未設定で 401 を返すこと", async () => {
    const app = new Hono<AppContext>();
    app.use("*", async (c, next) => {
      c.set("env", {} as never);
      c.set("db", {} as never);
      await next();
    });
    app.get("/novel/:id", async (c) => {
      const denied = await assertNovelAccess(c, c.req.param("id"));
      if (denied) {
        return denied;
      }
      return c.json({ ok: true });
    });
    const res = await app.request(
      "/novel/11111111-1111-4111-8111-111111111111"
    );
    expect(res.status).toBe(401);
  });

  it("assertNovelAccess は MASTER 設定・ユーザー未格納時に素通りすること", async () => {
    const app = new Hono<AppContext>();
    app.use("*", async (c, next) => {
      c.set("env", masterEnv() as never);
      c.set("db", {} as never);
      await next();
    });
    app.get("/novel/:id", async (c) => {
      const denied = await assertNovelAccess(c, c.req.param("id"));
      if (denied) {
        return denied;
      }
      return c.json({ ok: true });
    });
    const res = await app.request(
      "/novel/11111111-1111-4111-8111-111111111111"
    );
    expect(res.status).toBe(200);
  });
});
