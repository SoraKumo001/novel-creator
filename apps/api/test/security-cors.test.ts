import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

const TEST_MASTER_SECRET = "test-master-secret-0123456789";

function createTestApp(envOverrides = {}) {
  const context = {
    db: {} as never,
    embedding: {} as never,
    env: {
      MASTER_SECRET: TEST_MASTER_SECRET,
      NODE_ENV: "production",
      ...envOverrides,
    },
    llm: {} as never,
    services: {} as never,
    vectorStore: {} as never,
  };
  return createApp(context as never);
}

describe("Security: CORS Origin Validation", () => {
  it("本番環境で WEB_ORIGIN 未設定時は任意のリクエスト Origin を反射しないこと", async () => {
    const app = createTestApp({
      NODE_ENV: "production",
      WEB_ORIGIN: undefined,
    });
    const res = await app.request("/health", {
      headers: { Origin: "https://evil-attacker.com" },
      method: "GET",
    });
    expect(res.status).toBe(200);
    const allowOrigin = res.headers.get("Access-Control-Allow-Origin");
    expect(allowOrigin).not.toBe("https://evil-attacker.com");
    expect(allowOrigin).not.toBe("*");
  });

  it("本番環境で WEB_ORIGIN 設定時は指定されたオリジンのみ許可すること", async () => {
    const app = createTestApp({
      NODE_ENV: "production",
      WEB_ORIGIN: "https://my-app.example.com",
    });
    const res = await app.request("/health", {
      headers: { Origin: "https://evil-attacker.com" },
      method: "GET",
    });
    expect(res.status).toBe(200);
    const allowOrigin = res.headers.get("Access-Control-Allow-Origin");
    expect(allowOrigin).toBe("https://my-app.example.com");
  });

  it("開発環境では localhost オリジンを許可すること", async () => {
    const app = createTestApp({
      NODE_ENV: "development",
      WEB_ORIGIN: undefined,
    });
    const res = await app.request("/health", {
      headers: { Origin: "http://localhost:5173" },
      method: "GET",
    });
    expect(res.status).toBe(200);
    const allowOrigin = res.headers.get("Access-Control-Allow-Origin");
    expect(allowOrigin).toBe("http://localhost:5173");
  });
});
