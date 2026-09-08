import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import type { AppContext } from "../context.js";
import { verifyMcpKey } from "../core/mcp-key.service.js";
import { getServices } from "../core/services.js";
import { createNovelCreatorMcpServer } from "../mcp/server.js";

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
      await next();
      return;
    }
  }
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
  const services = getServices(c);
  const server = createNovelCreatorMcpServer(services, {
    db: c.get("db"),
    embedding: c.get("embedding"),
    env: c.get("env"),
    llm: c.get("llm"),
    vectorStore: c.get("vectorStore"),
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);

  const parsedBody = await c.req.json().catch(() => undefined);
  return transport.handleRequest(c.req.raw, { parsedBody });
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
