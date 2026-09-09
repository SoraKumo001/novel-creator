import { sql } from "drizzle-orm";
import { Hono } from "hono";

import type { AppContext } from "../context.js";
import { getMcpStats, renderMcpMetrics } from "../mcp/stats.js";

const MCP_TOOL_COUNT = 50;
const MCP_RESOURCE_COUNT = 5;
const MCP_PROMPT_COUNT = 3;

const healthRouter = new Hono<AppContext>();

/** DB疎通を確認する。失敗時は503を返す。 */
healthRouter.get("/healthz", async (c) => {
  try {
    await c.get("db").execute(sql`SELECT 1`);
    return c.json({ status: "ok" as const });
  } catch {
    return c.json({ status: "error" as const }, 503);
  }
});

/** MCP公開情報（認証不要）。 */
healthRouter.get("/api/mcp/health", (c) =>
  c.json({
    mcp: {
      prompts: MCP_PROMPT_COUNT,
      resources: MCP_RESOURCE_COUNT,
      tools: MCP_TOOL_COUNT,
    },
    stats: getMcpStats(),
    status: "ok" as const,
  })
);

/** Prometheus風メトリクス（認証要: app.ts の default-deny で保護）。 */
healthRouter.get("/api/mcp/metrics", (c) =>
  c.text(renderMcpMetrics(getMcpStats()), 200, {
    "Content-Type": "text/plain; version=0.0.4",
  })
);

export default healthRouter;
