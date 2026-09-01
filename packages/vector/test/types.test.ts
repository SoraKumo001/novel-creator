import { describe, expect, it } from "vitest";

import type {
  VectorRecord,
  VectorSearchResult,
  VectorStore,
} from "../src/types.js";

// ---- 型レベルテスト ----
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
        _options: {
          minScore?: number;
          novelId?: string;
          entityType?: string;
          topK?: number;
        }
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
