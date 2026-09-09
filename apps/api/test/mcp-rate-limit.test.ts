import type { Database } from "@novel-creator/db";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "../src/context.js";
import { hashMcpKeyToken } from "../src/core/mcp-key.service.js";
import {
  checkMcpRateLimit,
  checkRateLimit,
  extractMcpToolName,
  isExpensiveMcpTool,
  McpRequestTimeoutError,
  type RateLimitStore,
  withMcpTimeout,
} from "../src/mcp/rate-limit.js";
import { appLogger } from "../src/middleware/logger.js";
import mcpRouter from "../src/routes/mcp.js";

const TEST_IP = "203.0.113.7";
const TEST_KEY_ID = "key-ratelimit-1";
const TEST_TOKEN = "mcp_ratelimit-test-token-00000001";

function createMockDb(rows: unknown[]): Database {
  return {
    select: () => ({
      from: () => ({
        where: async () => rows,
      }),
    }),
  } as unknown as Database;
}

function createTestApp(db: Database): Hono<AppContext> {
  const app = new Hono<AppContext>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/api/mcp", mcpRouter);
  return app;
}

describe("checkRateLimit", () => {
  it("バースト内は許可し超過時は拒否すること", () => {
    const store: RateLimitStore = new Map();
    const bucket = { burst: 2, refillPerMinute: 60 };

    expect(checkRateLimit("k", { bucket, now: 0, store }).allowed).toBe(true);
    expect(checkRateLimit("k", { bucket, now: 0, store }).allowed).toBe(true);

    const denied = checkRateLimit("k", { bucket, now: 0, store });
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
  });

  it("時間が進むと補充されて許可されること", () => {
    const store: RateLimitStore = new Map();
    const bucket = { burst: 1, refillPerMinute: 60 };

    expect(checkRateLimit("k", { bucket, now: 0, store }).allowed).toBe(true);
    expect(checkRateLimit("k", { bucket, now: 0, store }).allowed).toBe(false);
    // 61秒後には1トークン以上補充される。
    expect(checkRateLimit("k", { bucket, now: 61_000, store }).allowed).toBe(
      true
    );
  });

  it("高コスト系ツールを判定できること", () => {
    expect(isExpensiveMcpTool("search_novel_knowledge")).toBe(true);
    expect(isExpensiveMcpTool("batch_save_section_contents")).toBe(true);
    expect(isExpensiveMcpTool("get_novel")).toBe(false);
    expect(isExpensiveMcpTool(null)).toBe(false);
    expect(
      extractMcpToolName({
        method: "tools/call",
        params: { name: "batch_save_section_contents" },
      })
    ).toBe("batch_save_section_contents");
    expect(extractMcpToolName({ method: "tools/list" })).toBeNull();
    expect(extractMcpToolName(null)).toBeNull();
  });
});

describe("POST /api/mcp 429", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("バケット枯渇時は429とRetry-Afterを返しwarnすること", async () => {
    const row = {
      expiresAt: null,
      id: TEST_KEY_ID,
      keyHash: await hashMcpKeyToken(TEST_TOKEN),
      novelId: null,
      revokedAt: null,
      userId: "user-1",
    };
    const app = createTestApp(createMockDb([row]));
    // 既定バケット(burst 10)を直接叩いて枯渇させる。
    for (let i = 0; i < 10; i += 1) {
      expect(
        checkMcpRateLimit({ ip: TEST_IP, keyId: TEST_KEY_ID }).allowed
      ).toBe(true);
    }
    const warn = vi.spyOn(appLogger, "warn");

    const res = await app.request("/api/mcp", {
      body: JSON.stringify({ jsonrpc: "2.0", method: "ping" }),
      headers: {
        Authorization: `Bearer ${TEST_TOKEN}`,
        "Content-Type": "application/json",
        "x-forwarded-for": TEST_IP,
      },
      method: "POST",
    });

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).not.toBeNull();
    const body = (await res.json()) as {
      error: { code: string; retryAfterSec: number };
    };
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.retryAfterSec).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("rate limited");
  });
});

describe("withMcpTimeout", () => {
  it("超過時はMcpRequestTimeoutErrorでrejectすること", async () => {
    await expect(
      withMcpTimeout(new Promise<never>(() => undefined), 10)
    ).rejects.toBeInstanceOf(McpRequestTimeoutError);
  });

  it("時間内はそのまま解決すること", async () => {
    await expect(withMcpTimeout(Promise.resolve("fast"), 1000)).resolves.toBe(
      "fast"
    );
  });
});
