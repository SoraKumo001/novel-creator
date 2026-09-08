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
  const server = new McpServer({
    name: "novel-creator",
    version: "1.0.0",
  });

  registerMcpTools(server, services, ctx);
  registerMcpResources(server, services, ctx);
  registerMcpPrompts(server, services, ctx);

  return server;
}
