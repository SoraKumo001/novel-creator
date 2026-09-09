import type { Database } from "@novel-creator/db";
import type { Context } from "hono";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppContext } from "../src/context.js";
import {
  logMcpAuthFailure,
  logMcpRequest,
  logMcpToolEvent,
  type McpAuditLogger,
  redactKeyPrefix,
} from "../src/mcp/audit.js";
import { appLogger } from "../src/middleware/logger.js";
import mcpRouter from "../src/routes/mcp.js";

interface CapturedCall {
  details: unknown[];
  message: string;
}

interface FakeLogger {
  calls: CapturedCall[];
  logger: McpAuditLogger;
}

function createFakeLogger(): FakeLogger {
  const calls: CapturedCall[] = [];
  const logger: McpAuditLogger = {
    error(message: string, ...details: unknown[]): void {
      calls.push({ details, message });
    },
    info(message: string, ...details: unknown[]): void {
      calls.push({ details, message });
    },
    warn(message: string, ...details: unknown[]): void {
      calls.push({ details, message });
    },
  };
  return { calls, logger };
}

function createFakeContext(
  overrides: { keyId?: string | null; method?: string; path?: string } = {}
): Context<AppContext> {
  return {
    get: ((key: string) =>
      key === "mcpAuth" && overrides.keyId
        ? { keyId: overrides.keyId }
        : null) as Context<AppContext>["get"],
    req: {
      method: overrides.method ?? "POST",
      path: overrides.path ?? "/api/mcp",
    },
  } as unknown as Context<AppContext>;
}

/** db は 401 パスでは触られないためダミーでよい。 */
function createTestApp(): Hono<AppContext> {
  const app = new Hono<AppContext>();
  app.use("*", async (c, next) => {
    c.set("db", {} as Database);
    await next();
  });
  app.route("/api/mcp", mcpRouter);
  return app;
}

describe("redactKeyPrefix", () => {
  it("先頭8文字のみ返すこと", () => {
    expect(redactKeyPrefix("mcp_abcdef1234567890")).toBe("mcp_abcd");
  });

  it("空・null・undefined は null を返すこと", () => {
    expect(redactKeyPrefix("")).toBeNull();
    expect(redactKeyPrefix(null)).toBeNull();
    expect(redactKeyPrefix(undefined)).toBeNull();
  });
});

describe("logMcpAuthFailure", () => {
  it("平文キーを出さず prefix のみ出すこと", () => {
    const { calls, logger } = createFakeLogger();
    const token = "mcp_secret-plain-key-should-never-appear";
    const c = createFakeContext();

    logMcpAuthFailure(c, "invalid", {
      keyPrefix: redactKeyPrefix(token),
      logger,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.message).toContain("auth failure");
    const detail = calls[0]?.details[0] as Record<string, unknown>;
    expect(detail["reason"]).toBe("invalid");
    expect(detail["keyPrefix"]).toBe("mcp_secr");
    expect(JSON.stringify(calls)).not.toContain(token);
  });

  it("トークンなしは missing で keyPrefix が null になること", () => {
    const { calls, logger } = createFakeLogger();

    logMcpAuthFailure(createFakeContext(), "missing", { logger });

    const detail = calls[0]?.details[0] as Record<string, unknown>;
    expect(detail["reason"]).toBe("missing");
    expect(detail["keyPrefix"]).toBeNull();
  });
});

describe("logMcpToolEvent", () => {
  it("成功は info で許可フィールドのみ出すこと", () => {
    const { calls, logger } = createFakeLogger();

    logMcpToolEvent(
      {
        durationMs: 12,
        keyId: "key-1",
        novelId: "novel-1",
        status: "ok",
        tool: "get_novel",
      },
      logger
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.message).toContain("tool");
    expect(calls[0]?.details[0]).toEqual({
      durationMs: 12,
      keyId: "key-1",
      novelId: "novel-1",
      status: "ok",
      tool: "get_novel",
    });
  });

  it("失敗は error で出すこと", () => {
    const { calls, logger } = createFakeLogger();

    logMcpToolEvent(
      { durationMs: 3, status: "error", tool: "create_novel" },
      logger
    );

    const detail = calls[0]?.details[0] as Record<string, unknown>;
    expect(detail["status"]).toBe("error");
    expect(detail["keyId"]).toBeNull();
    expect(detail["novelId"]).toBeNull();
  });
});

describe("logMcpRequest", () => {
  it("成功は info で method と duration を出すこと", () => {
    const { calls, logger } = createFakeLogger();

    logMcpRequest(
      createFakeContext({ keyId: "key-1" }),
      { durationMs: 42, ok: true },
      logger
    );

    const detail = calls[0]?.details[0] as Record<string, unknown>;
    expect(detail["method"]).toBe("POST");
    expect(detail["durationMs"]).toBe(42);
    expect(detail["status"]).toBe("ok");
    expect(detail["keyId"]).toBe("key-1");
  });

  it("失敗は error で出すこと", () => {
    const { calls, logger } = createFakeLogger();

    logMcpRequest(createFakeContext(), { durationMs: 7, ok: false }, logger);

    expect(calls).toHaveLength(1);
    const detail = calls[0]?.details[0] as Record<string, unknown>;
    expect(detail["status"]).toBe("error");
  });
});

describe("POST /api/mcp 401 監査ログ", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("トークンなしは 401 を返し missing で warn すること（形状維持）", async () => {
    const warn = vi.spyOn(appLogger, "warn");
    const app = createTestApp();

    const res = await app.request("/api/mcp", { method: "POST" });

    expect(res.status).toBe(401);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("auth failure");
    const detail = warn.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(detail["reason"]).toBe("missing");
  });

  it("不正トークンは 401 を返し invalid で warn すること（平文なし）", async () => {
    const warn = vi.spyOn(appLogger, "warn");
    const app = createTestApp();
    const token = "bad-token-should-never-appear-in-logs";

    const res = await app.request("/api/mcp", {
      headers: { Authorization: `Bearer ${token}` },
      method: "POST",
    });

    expect(res.status).toBe(401);
    expect(warn).toHaveBeenCalledTimes(1);
    const detail = warn.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(detail["reason"]).toBe("invalid");
    expect(detail["keyPrefix"]).toBe(token.slice(0, 8));
    expect(JSON.stringify(warn.mock.calls)).not.toContain(token);
  });
});
