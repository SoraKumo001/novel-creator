import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- pg.Pool のモック ----
// 実際の DB 接続は行わず、クエリテキストに応じて結果を差し替えて
// ensureSchema の次元検証の挙動を確認する。

const mockQuery = vi.fn();

vi.mock('pg', () => {
  class MockPool {
    query = mockQuery;
    on() {}
    end() {}
  }
  return { Pool: MockPool };
});

import { createPgVectorStore } from '../src/pg-vector-store.js';

// drizzle の node-postgres ドライバは client.query({ text, ... }, params) で呼び出す
function sqlTextOf(call: unknown[]): string {
  const first = call[0] as { text?: string } | string | undefined;
  if (typeof first === 'string') return first;
  return first?.text ?? '';
}

function callsContaining(fragment: string): unknown[][] {
  return mockQuery.mock.calls.filter((call) => sqlTextOf(call).includes(fragment));
}

/** 次元検証クエリ（pg_catalog 参照）かどうかで応答を分けるモック */
function stubDimensionQuery(existingDimensions: number | null): void {
  mockQuery.mockImplementation((...args: unknown[]) => {
    const text = sqlTextOf(args as unknown[]);
    if (text.includes('atttypmod')) {
      const rows = existingDimensions == null ? [] : [{ dimensions: existingDimensions }];
      return Promise.resolve({ rows, rowCount: rows.length });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
}

describe('PgVectorStore 次元検証', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('既存テーブルの次元と一致する場合は CREATE TABLE まで実行されること', async () => {
    stubDimensionQuery(1536);
    const store = createPgVectorStore('postgres://mock', 1536);
    await store.delete('11111111-1111-4111-8111-111111111111');
    expect(callsContaining('atttypmod')).toHaveLength(1);
    expect(callsContaining('CREATE TABLE')).toHaveLength(1);
  });

  it('既存テーブルの次元が異なる場合は明確なエラーで失敗すること', async () => {
    stubDimensionQuery(3072);
    const store = createPgVectorStore('postgres://mock', 1536);
    await expect(
      store.upsert({
        id: '11111111-1111-4111-8111-111111111111',
        novelId: '22222222-2222-2222-2222-222222222222',
        entityType: 'character',
        entityId: '33333333-3333-3333-3333-333333333333',
        content: 'アリス',
        embedding: [0.1, 0.2, 0.3],
      }),
    ).rejects.toThrow(/embedding 列の次元（3072）.*要求された次元（1536）.*一致しません/);
    // CREATE TABLE IF NOT EXISTS は実行されない（不一致のまま上書きしない）
    expect(callsContaining('CREATE TABLE')).toHaveLength(0);
  });

  it('テーブルが存在しない場合は検証をスキップして CREATE TABLE が実行されること', async () => {
    stubDimensionQuery(null);
    const store = createPgVectorStore('postgres://mock', 1536);
    await store.delete('11111111-1111-4111-8111-111111111111');
    expect(callsContaining('atttypmod')).toHaveLength(1);
    expect(callsContaining('CREATE TABLE')).toHaveLength(1);
  });
});
