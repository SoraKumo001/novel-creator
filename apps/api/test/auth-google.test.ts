import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AppContext } from "../src/context.js";
import { createAuth } from "../src/lib/auth.js";
import { registerAuthStatusRoute } from "../src/routes/auth.js";

const TEST_MASTER_SECRET = "test-master-secret-0123456789";

function baseEnv(
  overrides?: Partial<AppContext["Variables"]["env"]>
): AppContext["Variables"]["env"] {
  return {
    MASTER_SECRET: TEST_MASTER_SECRET,
    DATABASE_URL: "postgres://novel:novel@localhost:5433/novel",
    NODE_ENV: "test",
    VECTOR_STORE_PROVIDER: "pgvector",
    EMBEDDING_DIMENSIONS: 1536,
    EMBEDDING_MODEL: "text-embedding-3-small",
    LLM_MODEL: "gpt-4o-mini",
    LLM_PROVIDER: "openai",
    ...overrides,
  };
}

describe("Google Auth configuration", () => {
  it("Google 環境変数が設定されている場合でも createAuth は成功すること", async () => {
    const env = baseEnv({
      GOOGLE_CLIENT_ID: "google-client-id-123",
      GOOGLE_CLIENT_SECRET: "google-client-secret-xyz",
    });
    // mock DB
    const mockDb = {
      $client: {},
      select: () => ({ from: () => [] }),
    } as never;

    const auth = await createAuth(env, mockDb);
    expect(auth).toBeDefined();
    expect(typeof auth.handler).toBe("function");
  });

  it("GET /api/auth/status は Google 未設定時に googleAuthEnabled: false を返すこと", async () => {
    const app = new Hono<AppContext>();
    const env = baseEnv();
    app.use("*", async (c, next) => {
      c.set("env", env);
      c.set("db", {
        select: () => ({
          from: () => [{ value: 0 }],
        }),
      } as never);
      await next();
    });
    registerAuthStatusRoute(app);

    const res = await app.request("/api/auth/status");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      googleAuthEnabled: boolean;
      initialized: boolean;
    };
    expect(body.googleAuthEnabled).toBe(false);
    expect(body.initialized).toBe(false);
  });

  it("GET /api/auth/status は Google 設定時に googleAuthEnabled: true を返すこと", async () => {
    const app = new Hono<AppContext>();
    const env = baseEnv({
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
    });
    app.use("*", async (c, next) => {
      c.set("env", env);
      c.set("db", {
        select: () => ({
          from: () => [{ value: 1 }],
        }),
      } as never);
      await next();
    });
    registerAuthStatusRoute(app);

    const res = await app.request("/api/auth/status");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      googleAuthEnabled: boolean;
      initialized: boolean;
    };
    expect(body.googleAuthEnabled).toBe(true);
    expect(body.initialized).toBe(true);
  });

  it("embeddingConfigsRouter は一般ユーザーによる GET を許可し、変更操作 (POST) を 403 拒否すること", async () => {
    const { default: embeddingConfigsRouter } = await import(
      "../src/routes/embedding-configs.js"
    );
    const app = new Hono<AppContext>();
    app.use("*", async (c, next) => {
      c.set("env", baseEnv());
      c.set("user", {
        id: "u1",
        email: "user@example.com",
        role: "user",
        name: "Regular User",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      c.set("services", {
        embeddingConfig: {
          listConfigs: () => Promise.resolve([]),
        },
      } as never);
      await next();
    });
    app.route("/api/embedding-configs", embeddingConfigsRouter);

    // GET は一般ユーザーでも 200
    const getRes = await app.request("/api/embedding-configs");
    expect(getRes.status).toBe(200);

    // POST は一般ユーザーだと 403
    const postRes = await app.request("/api/embedding-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test",
        provider: "google",
        modelId: "text-embedding-004",
      }),
    });
    expect(postRes.status).toBe(403);
  });
});
