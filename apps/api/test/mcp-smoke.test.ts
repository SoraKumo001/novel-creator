import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import type { DomainServices } from "../src/core/services.js";
import type { ServiceContext } from "../src/core/types.js";
import { createNovelCreatorMcpServer } from "../src/mcp/server.js";

/**
 * MCP スモーク契約テスト。
 * server 生成→initialize→tools/list の疎通契約を検証する。
 */
describe("mcp smoke", () => {
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

    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain("get_novel");
    expect(names).toContain("delete_novel");
    await client.close();
  }, 30_000);
});
