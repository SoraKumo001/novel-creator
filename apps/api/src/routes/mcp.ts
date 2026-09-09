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
  checkBreaker,
  mcpBreakerKey,
  recordFailure,
  recordSuccess,
  releaseMcpSlot,
  tryAcquireMcpSlot,
} from "../mcp/breaker.js";
import {
  hasConfirmation,
  isOriginAllowed,
  requiresConfirmation,
} from "../mcp/policy.js";
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
    const auth = c.get("mcpAuth");

    // Origin 検証（DNS rebinding 対策。ヘッダがある場合のみ照合する）。
    // env 未設定のテスト用人脈でも落ちないよう任意アクセスにする。
    const env = c.get("env") as AppContext["Variables"]["env"] | undefined;
    const webOrigin = env?.WEB_ORIGIN;
    const origin = c.req.header("Origin") ?? c.req.header("origin");
    if (!isOriginAllowed(origin, webOrigin)) {
      appLogger.warn("[MCP] origin rejected", {
        keyId: auth?.keyId ?? null,
      });
      recordMcpEvent("error");
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Origin not allowed",
          },
        },
        403
      );
    }

    // 破壊的ツールは arguments.confirm === true を要求する。
    const callTool = extractMcpToolName(parsedBody);
    if (
      callTool &&
      requiresConfirmation(callTool) &&
      !hasConfirmation(parsedBody)
    ) {
      appLogger.warn("[MCP] confirmation required", {
        keyId: auth?.keyId ?? null,
        tool: callTool,
      });
      recordMcpEvent("error");
      return c.json(
        {
          error: {
            code: "CONFIRMATION_REQUIRED",
            message: `Tool ${callTool} requires confirmation. Pass arguments.confirm=true.`,
          },
        },
        400
      );
    }

    // サーキットブレーカー。open 中は即時 503 で遮断する。
    const breakerKey = mcpBreakerKey(auth?.keyId);
    const breaker = checkBreaker(breakerKey);
    if (breaker.open) {
      const retryAfterSec = breaker.retryAfterSec ?? 30;
      appLogger.warn("[MCP] circuit open", {
        keyId: auth?.keyId ?? null,
        retryAfterSec,
      });
      logMcpRequest(c, { durationMs: Date.now() - start, ok: false });
      recordMcpEvent("error");
      return c.json(
        {
          error: {
            code: "CIRCUIT_OPEN",
            message: "Service temporarily unavailable. Please retry later.",
            retryAfterSec,
          },
        },
        503,
        { "Retry-After": String(retryAfterSec) }
      );
    }

    // POST 入口でレート制限を評価する（重い処理の前に拒否する）。
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

    // 同時実行制限（プロセス内上限。超過時は 429）。
    if (!tryAcquireMcpSlot()) {
      appLogger.warn("[MCP] concurrent limit", {
        keyId: auth?.keyId ?? null,
      });
      logMcpRequest(c, { durationMs: Date.now() - start, ok: false });
      recordMcpEvent("error");
      return c.json(
        {
          error: {
            code: "CONCURRENT_LIMIT",
            message: "Too many concurrent requests. Please retry later.",
          },
        },
        429
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
      // SDK v1.30.0 が DNS rebinding 保護に対応しているため有効化する。
      // Origin の実照合は routes 層で行い、ここでは SDK 側の二重化に留める。
      // Origin ヘッダなしの非ブラウザクライアントは SDK 側で素通しされる。
      allowedOrigins: webOrigin ? [webOrigin.replace(/\/+$/, "")] : undefined,
      enableDnsRebindingProtection: true,
    });
    await server.connect(transport);

    const response = await (async () => {
      try {
        return await withMcpTimeout(
          Promise.race([
            transport.handleRequest(c.req.raw, { parsedBody }),
            rejectOnAbort(c.req.raw.signal),
          ]),
          MCP_REQUEST_TIMEOUT_MS
        );
      } catch (requestError) {
        releaseMcpSlot();
        throw requestError;
      }
    })();
    releaseMcpSlot();
    recordSuccess(breakerKey);
    logMcpRequest(c, { durationMs: Date.now() - start, ok: true });
    recordMcpEvent("ok");
    return response;
  } catch (error) {
    recordFailure(mcpBreakerKey(c.get("mcpAuth")?.keyId));
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
