import { parseEnv } from "@novel-creator/shared/env";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createContext } from "../src/context.js";
import { generateEncryptionKeyBase64 } from "../src/lib/secret-crypto.js";

// 結合テストでは認証ミドルウェアを素通りさせる。
// fail-closed の検証は auth-fail-closed.test.ts で行う。
vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/middleware/auth.js")>();
  return {
    ...actual,
    assertNovelAccess: () => Promise.resolve(null),
    requireAdmin: (_c: unknown, next: () => Promise<void>) => next(),
    requireAuth: (_c: unknown, next: () => Promise<void>) => next(),
    requireNovelAccess: () => (_c: unknown, next: () => Promise<void>) =>
      next(),
  };
});

describe("Embedding Configs API", () => {
  // S0-1: api_key 保存に暗号化鍵が必須のため、テスト専用 MASTER_SECRET をハーネス内で生成する。
  const env = parseEnv({
    ...process.env,
    MASTER_SECRET: generateEncryptionKeyBase64(),
  });
  const context = createContext(env);
  const app = createApp(context);

  it("GET /api/embedding-configs - 一覧を取得できること", async () => {
    const res = await app.request("/api/embedding-configs");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("POST /api/embedding-configs - 新しい埋め込み設定を作成できること", async () => {
    const res = await app.request("/api/embedding-configs", {
      body: JSON.stringify({
        apiKey: "AIzaFakeKey12345678",
        description: "テスト用Gemini埋め込み",
        dimensions: 768,
        modelId: "gemini-embedding-001",
        name: "Test Gemini Embedding",
        provider: "google",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("Test Gemini Embedding");
    expect(data.provider).toBe("google");
    expect(data.dimensions).toBe(768);
    expect(data.hasApiKey).toBe(true);
    expect(data.apiKeyMasked).toContain("AIza");

    // クリーンアップ
    if (data.id) {
      await app.request(`/api/embedding-configs/${data.id}`, {
        method: "DELETE",
      });
    }
  });
});
