import type { IncomingMessage, ServerResponse } from "node:http";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Hono } from "hono";
import type { AppContext } from "../context.js";
import { getServices } from "../core/services.js";
import { createNovelCreatorMcpServer } from "../mcp/server.js";
import { appLogger } from "../middleware/logger.js";

const mcpRouter = new Hono<AppContext>();

// MCP API Key 認証ミドルウェア（MCP_API_KEY が設定されている場合は検証）
mcpRouter.use("*", async (c, next) => {
  const env = c.get("env") as Record<string, unknown> | undefined;
  const mcpApiKey = (env?.MCP_API_KEY || process.env.MCP_API_KEY) as
    | string
    | undefined;

  if (mcpApiKey) {
    const authHeader = c.req.header("Authorization");
    const apiKeyHeader = c.req.header("x-api-key");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : apiKeyHeader;
    if (token !== mcpApiKey) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or missing MCP API Key",
          },
        },
        401
      );
    }
  }
  await next();
});

// アクティブな SSE トランスポートをセッションIDごとに管理
const sseTransports = new Map<string, SSEServerTransport>();

/**
 * GET /api/mcp/sse
 * SSE 接続を確立し、セッションを開始する。
 */
mcpRouter.get("/sse", async (c) => {
  // @hono/node-server から生の req / res を取得
  const envAny = c.env as unknown as {
    incoming?: IncomingMessage;
    outgoing?: ServerResponse;
  };
  const req = envAny.incoming;
  const res = envAny.outgoing;

  if (!req || !res) {
    return c.json(
      {
        error: {
          code: "NOT_SUPPORTED",
          message:
            "SSE transport is currently only supported in Node.js runtime",
        },
      },
      501
    );
  }

  // クエリまたはパス指定のエンドポイントURL（POST先）
  const endpoint = "/api/mcp/messages";
  const transport = new SSEServerTransport(endpoint, res);
  const sessionId = transport.sessionId;
  sseTransports.set(sessionId, transport);

  transport.onclose = () => {
    appLogger.info(`[MCP SSE] Connection closed for session ${sessionId}`);
    sseTransports.delete(sessionId);
  };

  transport.onerror = (error) => {
    appLogger.error(
      `[MCP SSE] Transport error for session ${sessionId}:`,
      error
    );
    sseTransports.delete(sessionId);
  };

  const services = getServices(c);
  const server = createNovelCreatorMcpServer(services, {
    db: c.get("db"),
    embedding: c.get("embedding"),
    env: c.get("env"),
    llm: c.get("llm"),
    vectorStore: c.get("vectorStore"),
  });

  await server.connect(transport);
  appLogger.info(`[MCP SSE] Client connected with sessionId: ${sessionId}`);

  // Hono のレスポンスは Node の res に直接書き込まれるため空で返却
  return new Response(null);
});

/**
 * POST /api/mcp/messages
 * クライアントからの JSON-RPC メッセージを受信・処理する。
 */
mcpRouter.post("/messages", async (c) => {
  const envAny = c.env as unknown as {
    incoming?: IncomingMessage;
    outgoing?: ServerResponse;
  };
  const req = envAny.incoming;
  const res = envAny.outgoing;

  if (!req || !res) {
    return c.json(
      {
        error: {
          code: "NOT_SUPPORTED",
          message:
            "SSE transport is currently only supported in Node.js runtime",
        },
      },
      501
    );
  }

  const sessionId = c.req.query("sessionId");
  if (!sessionId) {
    return c.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "sessionId query parameter is required",
        },
      },
      400
    );
  }

  const transport = sseTransports.get(sessionId);
  if (!transport) {
    return c.json(
      {
        error: { code: "NOT_FOUND", message: `Session ${sessionId} not found` },
      },
      404
    );
  }

  const parsedBody = await c.req.json().catch(() => undefined);
  await transport.handlePostMessage(req, res, parsedBody);
  return new Response(null);
});

export default mcpRouter;
