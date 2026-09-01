import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  VectorRecord,
  VectorSearchResult,
  VectorStore,
} from "../src/types.js";

// ---- 型レベルテスト（実行不要） ----
// コンパイル時に VectorStore インターフェースの契約を検証する。
describe("VectorStore インターフェース", () => {
  it("型契約を満たす実装を定義できること（型レベル）", () => {
    const store: VectorStore = {
      async delete(_id: string): Promise<void> {},
      async deleteByEntity(
        _entityType: string,
        _entityId: string
      ): Promise<void> {},
      async search(
        _query: number[],
        _options: { novelId?: string; entityType?: string; topK?: number }
      ): Promise<VectorSearchResult[]> {
        return [];
      },
      async upsert(_record: VectorRecord): Promise<void> {},
      async upsertBatch(_records: VectorRecord[]): Promise<void> {},
    };
    // 型が通れば OK。実行時は何もしない。
    expect(store).toBeDefined();
  });

  it("VectorRecord の必須フィールドを持つこと（型レベル）", () => {
    const record: VectorRecord = {
      content: "テキスト",
      embedding: [0.1, 0.2],
      entityId: "entity-uuid",
      entityType: "character",
      id: "uuid",
      novelId: "novel-uuid",
    };
    expect(record.id).toBe("uuid");
    expect(record.embedding).toHaveLength(2);
  });
});

// ---- PgVectorStore のモックテスト ----
// pg.Pool をモック化して、upsert / search / delete の呼び出しを確認する。
// 実際の DB 接続は行わない。

const mockQuery = vi.fn();

vi.mock("pg", () => {
  class MockPool {
    query = mockQuery;
    on() {}
    end() {}
  }
  return { Pool: MockPool };
});

import { createPgVectorStore } from "../src/pg-vector-store.js";

describe("PgVectorStore", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    // schema 作成クエリは成功させる
    mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
  });

  it("upsert が呼び出されること", async () => {
    const store = createPgVectorStore("postgres://mock", 1536);
    await store.upsert({
      content: "アリス",
      embedding: [0.1, 0.2, 0.3],
      entityId: "33333333-3333-3333-3333-333333333333",
      entityType: "character",
      id: "11111111-1111-4111-8111-111111111111",
      novelId: "22222222-2222-2222-2222-222222222222",
    });
    // schema 作成 + upsert の INSERT が呼ばれる
    expect(mockQuery).toHaveBeenCalled();
  });

  it("search が呼び出されること", async () => {
    mockQuery.mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          content: "アリス",
          distance: 0.2,
          entity_id: "33333333-3333-3333-3333-333333333333",
          entity_type: "character",
          id: "11111111-1111-4111-8111-111111111111",
          metadata: null,
        },
      ],
    });
    const store = createPgVectorStore("postgres://mock", 1536);
    const results = await store.search([0.1, 0.2, 0.3], {
      novelId: "22222222-2222-2222-2222-222222222222",
      topK: 5,
    });
    // 検索クエリが発行されたことを確認する。
    expect(mockQuery).toHaveBeenCalled();
    // 結果は配列として返る。
    expect(Array.isArray(results)).toBe(true);
  });

  it("delete が呼び出されること", async () => {
    const store = createPgVectorStore("postgres://mock", 1536);
    await store.delete("11111111-1111-4111-8111-111111111111");
    expect(mockQuery).toHaveBeenCalled();
  });
});
