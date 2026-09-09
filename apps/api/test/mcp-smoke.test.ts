import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import type { DomainServices } from "../src/core/services.js";
import type { ServiceContext } from "../src/core/types.js";
import { createNovelCreatorMcpServer } from "../src/mcp/server.js";

interface McpServerInternals {
  _registeredPrompts: Record<string, unknown>;
  _registeredResourceTemplates: Record<string, unknown>;
  _registeredTools: Record<string, unknown>;
}

/**
 * MCP スモーク契約テスト。
 * server 生成→initialize→tools/list の軽量契約と、
 * tools 55 / resources 5 / prompts 3 の件数固定のみを検証する。
 * 件数が実装数と乖離したら失敗させる。
 */
describe("mcp smoke", () => {
  it("登録件数が契約通りであること", () => {
    const server = createNovelCreatorMcpServer(
      {} as DomainServices,
      {} as ServiceContext
    );
    const internals = server as unknown as McpServerInternals;

    expect(Object.keys(internals._registeredTools)).toHaveLength(55);
    expect(Object.keys(internals._registeredResourceTemplates)).toHaveLength(5);
    expect(Object.keys(internals._registeredPrompts)).toHaveLength(10);
  });

  it("initialize→tools/list が通ること", async () => {
    const server = createNovelCreatorMcpServer(
      {} as DomainServices,
      {} as ServiceContext
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client(
      { name: "smoke", version: "0.0.0" },
      { capabilities: {} }
    );
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);

    const names: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await client.listTools(
        cursor === undefined ? undefined : { cursor }
      );
      for (const tool of page.tools) {
        names.push(tool.name);
      }
      cursor = page.nextCursor;
    } while (cursor !== undefined);

    expect(names).toHaveLength(55);
    expect(names).toContain("get_novel");
    expect(names).toContain("delete_novel");
    await client.close();
  }, 30_000);
});
