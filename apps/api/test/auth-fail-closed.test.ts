import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import type { AppContext } from "../src/context.js";
import {
  assertAuthConfigured,
  createAuth,
  isInsecureAuthBypassAllowed,
  resolveAuthSecret,
  TEST_ONLY_AUTH_SECRET,
} from "../src/lib/auth.js";
import { assertNovelAccess, requireAuth } from "../src/middleware/auth.js";

const BYPASS_FLAG = "ALLOW_INSECURE_AUTH_FOR_TESTS";

function clearBypassFlag(): void {
  delete process.env[BYPASS_FLAG];
}

afterEach(() => {
  vi.unstubAllEnvs();
  clearBypassFlag();
});

describe("auth fail-closed (S0-2)", () => {
  it("resolveAuthSecret は secret 設定時にその値を返すこと", () => {
    clearBypassFlag();
    expect(
      resolveAuthSecret({
        BETTER_AUTH_SECRET: "test-secret-value",
      } as AppContext["Variables"]["env"])
    ).toBe("test-secret-value");
  });

  it("resolveAuthSecret は未設定・フラグ無しで throw すること", () => {
    clearBypassFlag();
    expect(() =>
      resolveAuthSecret({} as AppContext["Variables"]["env"])
    ).toThrow(/BETTER_AUTH_SECRET is not configured/);
  });

  it("resolveAuthSecret は未設定でも明示バイパス時はテスト専用 secret を返すこと", () => {
    vi.stubEnv(BYPASS_FLAG, "true");
    expect(isInsecureAuthBypassAllowed()).toBe(true);
    expect(resolveAuthSecret({} as AppContext["Variables"]["env"])).toBe(
      TEST_ONLY_AUTH_SECRET
    );
  });

  it("createAuth は未設定・フラグ無しで throw すること", () => {
    clearBypassFlag();
    expect(() =>
      createAuth({} as AppContext["Variables"]["env"], {} as never)
    ).toThrow(/BETTER_AUTH_SECRET is not configured/);
  });

  it("assertAuthConfigured は未設定・フラグ無しで throw すること", () => {
    clearBypassFlag();
    expect(() =>
      assertAuthConfigured({} as AppContext["Variables"]["env"])
    ).toThrow(/BETTER_AUTH_SECRET is not configured/);
  });

  it("createApp は未設定・フラグ無しで起動時 throw すること", () => {
    clearBypassFlag();
    const context = {
      db: {},
      embedding: {},
      env: {},
      llm: {},
      services: {},
      vectorStore: {},
    } as never;
    expect(() => createApp(context)).toThrow(
      /BETTER_AUTH_SECRET is not configured/
    );
  });

  it("requireAuth は未設定・フラグ無しで素通りせず 500 を返すこと", async () => {
    clearBypassFlag();
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

  it("requireAuth は明示バイパス時に素通りすること", async () => {
    vi.stubEnv(BYPASS_FLAG, "true");
    const app = new Hono<AppContext>();
    app.use("*", async (c, next) => {
      c.set("env", {} as never);
      c.set("db", {} as never);
      await next();
    });
    app.use("/api/*", requireAuth);
    app.get("/api/novels", (c) => c.json([]));
    const res = await app.request("/api/novels");
    expect(res.status).toBe(200);
  });

  it("assertNovelAccess は未設定・フラグ無しで 401 を返すこと", async () => {
    clearBypassFlag();
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

  it("assertNovelAccess は明示バイパス時に素通りすること", async () => {
    vi.stubEnv(BYPASS_FLAG, "true");
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
    expect(res.status).toBe(200);
  });
});
