import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { AppContext } from "../src/context.js";
import {
  getMcpStats,
  recordMcpEvent,
  resetMcpStats,
} from "../src/mcp/stats.js";
import healthRouter from "../src/routes/health.js";

function createTestApp(db: unknown): Hono<AppContext> {
  const app = new Hono<AppContext>();
  app.use("*", async (c, next) => {
    c.set("db", db as AppContext["Variables"]["db"]);
    await next();
  });
  app.route("/", healthRouter);
  return app;
}

describe("getMcpStats", () => {
  it("status別に集計すること", () => {
    resetMcpStats();
    recordMcpEvent("ok");
    recordMcpEvent("ok");
    recordMcpEvent("auth_fail");
    recordMcpEvent("rate_limited");
    recordMcpEvent("timeout");
    recordMcpEvent("error");

    const stats = getMcpStats();
    expect(stats.totals).toBe(6);
    expect(stats.perStatus).toEqual({
      auth_fail: 1,
      error: 1,
      ok: 2,
      rate_limited: 1,
      timeout: 1,
    });
    expect(stats.uptimeSec).toBeGreaterThanOrEqual(0);
  });
});

describe("GET /healthz", () => {
  it("DB疎通成功時は200を返すこと", async () => {
    const app = createTestApp({ execute: async () => [] });

    const res = await app.request("/healthz");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("DB疎通失敗時は503を返すこと", async () => {
    const app = createTestApp({
      execute: async () => {
        throw new Error("db down");
      },
    });

    const res = await app.request("/healthz");

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "error" });
  });
});

describe("GET /api/mcp/health", () => {
  it("認証なしで公開情報とstatsを返すこと", async () => {
    resetMcpStats();
    recordMcpEvent("ok");
    const app = createTestApp({ execute: async () => [] });

    const res = await app.request("/api/mcp/health");

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      mcp: { prompts: number; resources: number; tools: number };
      stats: { totals: number };
      status: string;
    };
    expect(body.status).toBe("ok");
    expect(body.mcp).toEqual({ prompts: 3, resources: 5, tools: 50 });
    expect(body.stats.totals).toBe(1);
  });

  it("メトリクスをPrometheus風テキストで返すこと", async () => {
    resetMcpStats();
    recordMcpEvent("ok");
    const app = createTestApp({ execute: async () => [] });

    const res = await app.request("/api/mcp/metrics");

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('mcp_tool_events_total{status="ok"} 1');
    expect(text).toContain("mcp_uptime_seconds");
  });
});
