import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DomainServices } from "../core/services.js";
import type { ServiceContext } from "../core/types.js";
import { registerMcpPrompts } from "./prompts.js";
import { registerMcpResources } from "./resources.js";
import { registerMcpTools } from "./tools.js";

/**
 * novel-creator 用の McpServer インスタンスを生成する。
 */
export function createNovelCreatorMcpServer(
  services: DomainServices,
  ctx: ServiceContext
): McpServer {
  const server = new McpServer(
    {
      name: "novel-creator",
      version: "1.0.0",
    },
    {
      // SDK v1.30.0 が対応しているため list 変更通知を有効化する。
      capabilities: {
        prompts: { listChanged: true },
        resources: { listChanged: true },
        tools: { listChanged: true },
      },
    }
  );

  registerMcpTools(server, services, ctx);
  registerMcpResources(server, services, ctx);
  registerMcpPrompts(server, services, ctx);

  return server;
}

/**
 * tools/list 変更通知を送る。server.notification に対応していない
 * SDK では何もしない（noop）。
 */
export async function notifyToolsChanged(server: McpServer): Promise<void> {
  const inner = (
    server as unknown as {
      server?: { notification?: (notice: object) => Promise<void> };
    }
  ).server;
  if (inner && typeof inner.notification === "function") {
    await inner.notification({ method: "notifications/tools/list_changed" });
  }
}
