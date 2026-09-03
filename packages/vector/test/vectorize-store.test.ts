import { describe, expect, it } from "vitest";

import {
  createVectorizeStore,
  type VectorizeBinding,
} from "../src/vectorize-store.js";

interface FakeVector {
  id: string;
  metadata: Record<string, unknown>;
  values: number[];
}

function createFakeBinding(seed: FakeVector[] = []) {
  const vectors = new Map(seed.map((v) => [v.id, v]));
  const queryCalls: Array<{ filter?: Record<string, unknown>; topK?: number }> =
    [];
  const deleteCalls: string[][] = [];

  const binding: VectorizeBinding = {
    async deleteByIds(
      ids: string[]
    ): Promise<{ count: number; ids: string[] }> {
      deleteCalls.push(ids);
      const deleted: string[] = [];
      for (const id of ids) {
        if (vectors.delete(id)) {
          deleted.push(id);
        }
      }
      return { count: deleted.length, ids: deleted };
    },
    async describe() {
      return { dimensions: 8 };
    },
    async query(_vector, options) {
      queryCalls.push({ filter: options?.filter, topK: options?.topK });
      const topK = options?.topK ?? 10;
      const filter = options?.filter ?? {};
      const matches = [...vectors.values()]
        .filter((v) =>
          Object.entries(filter).every(
            ([key, value]) => v.metadata[key] === value
          )
        )
        .slice(0, topK)
        .map((v) => ({ id: v.id, metadata: v.metadata, score: 0.5 }));
      return { count: matches.length, matches };
    },
    async upsert(): Promise<void> {},
  };

  return { binding, deleteCalls, queryCalls, vectors };
}

function makeVector(id: string, metadata: Record<string, unknown>): FakeVector {
  return { id, metadata, values: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8] };
}

const NOVEL_A = "11111111-1111-4111-8111-111111111111";
const NOVEL_B = "22222222-2222-4222-8222-222222222222";

describe("VectorizeStore", () => {
  it("clearAll は topK 上限を超える件数でも全件削除できること", async () => {
    const seed = Array.from({ length: 2500 }, (_, i) =>
      makeVector(`v${i}`, { novelId: NOVEL_A, entityType: "content" })
    );
    const { binding, deleteCalls, queryCalls, vectors } =
      createFakeBinding(seed);
    const store = createVectorizeStore(binding);

    await store.clearAll();

    expect(vectors.size).toBe(0);
    // 2500 件 = 1000 + 1000 + 500 の削除バッチと、最終の空スキャンで 4 回クエリされる
    expect(queryCalls.length).toBe(4);
    expect(deleteCalls.length).toBe(3);
    expect(deleteCalls[0]).toHaveLength(1000);
    expect(deleteCalls[1]).toHaveLength(1000);
    expect(deleteCalls[2]).toHaveLength(500);
  });

  it("clearAll は空のインデックスでは 1 回だけクエリして終了すること", async () => {
    const { binding, deleteCalls, queryCalls, vectors } = createFakeBinding();
    const store = createVectorizeStore(binding);

    await store.clearAll();

    expect(vectors.size).toBe(0);
    expect(queryCalls.length).toBe(1);
    expect(deleteCalls.length).toBe(0);
  });

  it("deleteByEntity は topK 上限を超える件数でも全件削除できること", async () => {
    const seed = [
      ...Array.from({ length: 2500 }, (_, i) =>
        makeVector(`v${i}`, { entityId: "e1", entityType: "character" })
      ),
      makeVector("other-1", { entityId: "e2", entityType: "character" }),
    ];
    const { binding, deleteCalls, queryCalls, vectors } =
      createFakeBinding(seed);
    const store = createVectorizeStore(binding);

    await store.deleteByEntity("character", "e1");

    expect(vectors.size).toBe(1);
    expect(vectors.has("other-1")).toBe(true);
    expect(queryCalls.length).toBe(4);
    expect(deleteCalls.length).toBe(3);
    expect(queryCalls[0]?.filter).toEqual({
      entityId: "e1",
      entityType: "character",
    });
  });

  it("deleteByNovel は topK 上限を超える件数でも全件削除できること", async () => {
    const seed = [
      ...Array.from({ length: 2500 }, (_, i) =>
        makeVector(`v${i}`, { novelId: NOVEL_A })
      ),
      makeVector("other-1", { novelId: NOVEL_B }),
    ];
    const { binding, deleteCalls, queryCalls, vectors } =
      createFakeBinding(seed);
    const store = createVectorizeStore(binding);

    await store.deleteByNovel(NOVEL_A);

    expect(vectors.size).toBe(1);
    expect(vectors.has("other-1")).toBe(true);
    expect(queryCalls.length).toBe(4);
    expect(deleteCalls.length).toBe(3);
    expect(queryCalls[0]?.filter).toEqual({ novelId: NOVEL_A });
  });

  it("search はメタデータフィルタと minScore で絞り込めること", async () => {
    const seed = [
      makeVector("a1", {
        content: "甲",
        entityId: "e1",
        entityType: "character",
      }),
      makeVector("a2", {
        content: "乙",
        entityId: "e1",
        entityType: "character",
      }),
      makeVector("b1", {
        content: "丙",
        entityId: "e2",
        entityType: "setting",
      }),
    ];
    const { binding } = createFakeBinding(seed);
    const store = createVectorizeStore(binding);

    const results = await store.search(
      [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
      {
        entityType: "character",
      }
    );

    expect(results.map((r) => r.id)).toEqual(["a1", "a2"]);
  });
});
