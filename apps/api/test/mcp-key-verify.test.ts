import type { McpApiKey } from "@novel-creator/db";
import { describe, expect, it } from "vitest";
import { hashMcpKeyToken, verifyMcpKey } from "../src/core/mcp-key.service.js";

// ---- DB モック ----
// verifyMcpKey の select().from().where() チェーンのみをスタブする。
function createMockDb(rows: McpApiKey[]) {
  return {
    select: () => ({
      from: () => ({
        where: async () => rows,
      }),
    }),
  };
}

function toRow(overrides: Partial<McpApiKey> = {}): McpApiKey {
  const now = new Date();
  return {
    createdAt: now,
    encryptedKey: "enc:v1:dummy",
    expiresAt: null,
    id: "11111111-1111-4111-8111-111111111111",
    keyHash: "dummy-hash",
    name: "test-key",
    novelId: null,
    prefix: "mcp_abcd",
    revokedAt: null,
    updatedAt: now,
    userId: "user-1",
    ...overrides,
  };
}

describe("verifyMcpKey", () => {
  it("有効なトークンはレコードを返すこと", async () => {
    const token = "mcp_validtoken12345678901234567890abcd";
    const row = toRow({ keyHash: await hashMcpKeyToken(token) });
    const db = createMockDb([row]);

    const result = await verifyMcpKey(db as never, token);
    expect(result?.id).toBe(row.id);
  });

  it("失効済みキーは null を返すこと", async () => {
    const token = "mcp_revokedtoken1234567890123456789abc";
    const row = toRow({
      keyHash: await hashMcpKeyToken(token),
      revokedAt: new Date(),
    });
    const db = createMockDb([row]);

    await expect(verifyMcpKey(db as never, token)).resolves.toBeNull();
  });

  it("期限切れキーは null を返すこと", async () => {
    const token = "mcp_expiredtoken1234567890123456789abc";
    const row = toRow({
      expiresAt: new Date(Date.now() - 1000),
      keyHash: await hashMcpKeyToken(token),
    });
    const db = createMockDb([row]);

    await expect(verifyMcpKey(db as never, token)).resolves.toBeNull();
  });

  it("mcp_ 形式でないトークンは DB を見ずに null を返すこと", async () => {
    const db = createMockDb([toRow()]);
    await expect(verifyMcpKey(db as never, "not-a-key")).resolves.toBeNull();
  });
});
