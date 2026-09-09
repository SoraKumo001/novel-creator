import type { Database } from "@novel-creator/db";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "../src/context.js";
import { hashMcpKeyToken } from "../src/core/mcp-key.service.js";
import type { DomainServices } from "../src/core/services.js";
import {
  hasConfirmation,
  isOriginAllowed,
  isToolAllowed,
  requiresConfirmation,
} from "../src/mcp/policy.js";
import { appLogger } from "../src/middleware/logger.js";
import mcpRouter from "../src/routes/mcp.js";

const WEB_ORIGIN = "https://app.example.com";
const TEST_IP = "203.0.113.9";

interface TestKey {
  keyId: string;
  token: string;
}

async function createTestKey(keyId: string): Promise<TestKey> {
  const token = `mcp_policy-test-token-${keyId}`;
  return { keyId, token };
}

function createTestApp(
  db: Database,
  services: unknown,
  deleteNovel: ReturnType<typeof vi.fn>
): Hono<AppContext> {
  const app = new Hono<AppContext>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("services", services as DomainServices);
    c.set("embedding", {} as AppContext["Variables"]["embedding"]);
    c.set("env", { WEB_ORIGIN } as AppContext["Variables"]["env"]);
    c.set("llm", {} as AppContext["Variables"]["llm"]);
    c.set("vectorStore", {} as AppContext["Variables"]["vectorStore"]);
    await next();
  });
  app.route("/api/mcp", mcpRouter);
  return app;
}

async function setupValidKey(keyId: string): Promise<{
  app: Hono<AppContext>;
  deleteNovel: ReturnType<typeof vi.fn>;
  token: string;
}> {
  const { token } = await createTestKey(keyId);
  const db = {
    select: () => ({
      from: () => ({
        where: async () => [
          {
            expiresAt: null,
            id: keyId,
            keyHash: await hashMcpKeyToken(token),
            novelId: null,
            revokedAt: null,
            userId: "user-1",
          },
        ],
      }),
    }),
  } as unknown as Database;
  const deleteNovel = vi.fn().mockResolvedValue(undefined);
  const services = { novel: { deleteNovel } };
  return { app: createTestApp(db, services, deleteNovel), deleteNovel, token };
}

function postHeaders(token: string, origin?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "x-forwarded-for": TEST_IP,
  };
  if (origin !== undefined) {
    headers["Origin"] = origin;
  }
  return headers;
}

describe("POST /api/mcp Origin検証", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Origin一致は通過すること", async () => {
    const { app, token } = await setupValidKey("key-pol-1");

    const res = await app.request("/api/mcp", {
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/list" }),
      headers: postHeaders(token, WEB_ORIGIN),
      method: "POST",
    });

    expect(res.status).toBe(200);
  });

  it("Origin不一致は403を返しwarnすること", async () => {
    const warn = vi.spyOn(appLogger, "warn");
    const { app, token } = await setupValidKey("key-pol-2");

    const res = await app.request("/api/mcp", {
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/list" }),
      headers: postHeaders(token, "https://evil.example.com"),
      method: "POST",
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("origin rejected");
  });
});

describe("POST /api/mcp destructive確認", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function deleteNovelBody(confirm?: boolean): string {
    return JSON.stringify({
      id: 2,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: {
          confirm,
          novelId: "11111111-1111-4111-8111-111111111111",
        },
        name: "delete_novel",
      },
    });
  }

  it("confirmなしは400を返しwarnすること", async () => {
    const warn = vi.spyOn(appLogger, "warn");
    const { app, deleteNovel, token } = await setupValidKey("key-pol-3");

    const res = await app.request("/api/mcp", {
      body: deleteNovelBody(),
      headers: postHeaders(token),
      method: "POST",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("CONFIRMATION_REQUIRED");
    expect(deleteNovel).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("confirmation required");
  });

  it("confirmありは通過すること", async () => {
    const { app, deleteNovel, token } = await setupValidKey("key-pol-4");

    const res = await app.request("/api/mcp", {
      body: deleteNovelBody(true),
      headers: postHeaders(token),
      method: "POST",
    });

    expect(res.status).toBe(200);
    expect(deleteNovel).toHaveBeenCalledTimes(1);
  });
});

describe("policy", () => {
  it("通常toolは許可・確認不要、destructiveは確認要と判定すること", () => {
    expect(isToolAllowed(undefined, "get_novel")).toBe(true);
    expect(
      isToolAllowed(
        { keyId: "k", novelId: null, userId: "u" },
        "search_novel_knowledge"
      )
    ).toBe(true);
    expect(
      isToolAllowed({ keyId: "k", novelId: "n1", userId: "u" }, "get_novel", {
        allowedTools: ["get_novel"],
      })
    ).toBe(true);
    expect(
      isToolAllowed({ keyId: "k", novelId: "n1", userId: "u" }, "get_novel", {
        allowedTools: ["list_novels"],
      })
    ).toBe(false);
    expect(requiresConfirmation("get_novel")).toBe(false);
    expect(requiresConfirmation("delete_novel")).toBe(true);
    expect(hasConfirmation({ params: { arguments: { confirm: true } } })).toBe(
      true
    );
    expect(hasConfirmation({ params: { arguments: {} } })).toBe(false);
    expect(isOriginAllowed(null, WEB_ORIGIN)).toBe(true);
    expect(isOriginAllowed(WEB_ORIGIN, WEB_ORIGIN)).toBe(true);
    expect(isOriginAllowed("https://evil.example.com", WEB_ORIGIN)).toBe(false);
  });
});
