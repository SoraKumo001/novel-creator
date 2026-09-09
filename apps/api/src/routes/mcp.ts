import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import type { AppContext } from "../context.js";
import { verifyMcpKey } from "../core/mcp-key.service.js";
import { getServices } from "../core/services.js";
import {
  logMcpAuthFailure,
  logMcpRequest,
  redactKeyPrefix,
} from "../mcp/audit.js";
import {
  checkMcpRateLimit,
  extractMcpToolName,
  MCP_REQUEST_TIMEOUT_MS,
  McpRequestTimeoutError,
  rejectOnAbort,
  withMcpTimeout,
} from "../mcp/rate-limit.js";
import { createNovelCreatorMcpServer } from "../mcp/server.js";
import { recordMcpEvent } from "../mcp/stats.js";
import { appLogger } from "../middleware/logger.js";

const mcpRouter = new Hono<AppContext>();

// MCP 認証ミドルウェア（fail-closed）。
// Web 発行キー（mcp_api_keys）のみを検証する。合致しなければ 401。
mcpRouter.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const apiKeyHeader = c.req.header("x-api-key");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : apiKeyHeader;

  if (token) {
    const issued = await verifyMcpKey(c.get("db"), token);
    if (issued) {
      c.set("mcpAuth", {
        keyId: issued.id,
        novelId: issued.novelId,
        userId: issued.userId,
      });
      await next();
      return;
    }
    // verifyMcpKey は revoked/expired も null で返すため、
    // この層で区別できるのは missing/invalid の範囲に留める。
    logMcpAuthFailure(c, "invalid", { keyPrefix: redactKeyPrefix(token) });
  } else {
    logMcpAuthFailure(c, "missing");
  }
  recordMcpEvent("auth_fail");
  return c.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or missing MCP API Key",
      },
    },
    401
  );
});

/**
 * POST /api/mcp
 * Streamable HTTP（Web Standard）エンドポイント。ステートレス運用。
 * リクエストごとにサーバーを生成し、node:http には一切依存しないため
 * Node.js / Cloudflare Workers の双方で動作する。
 */
mcpRouter.post("/", async (c) => {
  const start = Date.now();
  try {
    const parsedBody = await c.req.json().catch(() => undefined);

    // POST 入口でレート制限を評価する（重い処理の前に拒否する）。
    const auth = c.get("mcpAuth");
    const forwarded = c.req.header("x-forwarded-for");
    const ip =
      forwarded?.split(",")[0]?.trim() ||
      c.req.header("cf-connecting-ip") ||
      "unknown";
    const tool = extractMcpToolName(parsedBody);
    const rate = checkMcpRateLimit({
      ip,
      keyId: auth?.keyId ?? "anonymous",
      tool,
    });
    if (!rate.allowed) {
      const retryAfterSec = rate.retryAfterSec ?? 60;
      appLogger.warn("[MCP] rate limited", {
        keyId: auth?.keyId ?? null,
        retryAfterSec,
        tool,
      });
      logMcpRequest(c, { durationMs: Date.now() - start, ok: false });
      recordMcpEvent("rate_limited");
      return c.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Rate limit exceeded. Please retry later.",
            retryAfterSec,
          },
        },
        429,
        { "Retry-After": String(retryAfterSec) }
      );
    }

    const services = getServices(c);
    const server = createNovelCreatorMcpServer(services, {
      db: c.get("db"),
      embedding: c.get("embedding"),
      env: c.get("env"),
      llm: c.get("llm"),
      mcpAuth: c.get("mcpAuth"),
      vectorStore: c.get("vectorStore"),
    });

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);

    const response = await withMcpTimeout(
      Promise.race([
        transport.handleRequest(c.req.raw, { parsedBody }),
        rejectOnAbort(c.req.raw.signal),
      ]),
      MCP_REQUEST_TIMEOUT_MS
    );
    logMcpRequest(c, { durationMs: Date.now() - start, ok: true });
    recordMcpEvent("ok");
    return response;
  } catch (error) {
    logMcpRequest(c, { durationMs: Date.now() - start, ok: false });
    if (error instanceof McpRequestTimeoutError) {
      recordMcpEvent("timeout");
      appLogger.warn("[MCP] request timeout", {
        keyId: c.get("mcpAuth")?.keyId ?? null,
      });
      return c.json(
        {
          error: {
            code: "TIMEOUT",
            message: "MCP request timed out",
          },
        },
        504
      );
    }
    recordMcpEvent("error");
    throw error;
  }
});

// Streamable HTTP では GET / DELETE によるストリーム確立・セッション終了は
// ステートレス運用の対象外のため 405 を返す。
mcpRouter.on(["GET", "DELETE"], "/", (c) =>
  c.json(
    {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Use POST /api/mcp for Streamable HTTP requests",
      },
    },
    405
  )
);

export default mcpRouter;
