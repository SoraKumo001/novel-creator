import { Hono } from 'hono';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { AppContext } from '../src/context.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import novelsRouter from '../src/routes/novels.js';

// ---- DB モック ----
// createContext をモック化して db 操作をスタブする。
// 実際の DB 接続は行わない。

interface MockDb {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

function createMockDb(): MockDb {
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return db;
}

// テスト用の Hono アプリを構築する。
// db をモックに差し替え、ルーターとエラーハンドラを登録する。
function createTestApp(db: MockDb) {
  const app = new Hono<AppContext>();
  app.use('*', async (c, next) => {
    c.set('env', {} as never);
    c.set('db', db as never);
    c.set('llm', {} as never);
    c.set('embedding', {} as never);
    c.set('vectorStore', {} as never);
    await next();
  });
  app.onError(errorHandler);
  app.route('/api/novels', novelsRouter);
  return app;
}

// drizzle の eq 条件を簡易的に判定するためのヘルパー。
// モックでは条件の内容は検証せず、呼び出し回数と返り値のみを検証する。

describe('novels CRUD', () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it('POST /api/novels → 201 で作成されること', async () => {
    const created = {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'テスト小説',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // insert().values().returning() のチェーンをモック
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([created]),
      }),
    });

    const app = createTestApp(db);
    const res = await app.request('/api/novels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'テスト小説' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('テスト小説');
    expect(db.insert).toHaveBeenCalled();
  });

  it('GET /api/novels → 200 で配列が返ること', async () => {
    const rows = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: '小説1',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    });

    const app = createTestApp(db);
    const res = await app.request('/api/novels');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it('GET /api/novels/:id → 200 で詳細が返ること', async () => {
    const novel = {
      id: '11111111-1111-4111-8111-111111111111',
      title: '小説1',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // 1回目: 小説本体の取得（select().from().where()）
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([novel]),
      }),
    });
    // 2回目以降: 関連データ（chapters, characters, settings）の取得
    // chapters は orderBy を使うため、where() が orderBy() を持つオブジェクトを返す。
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    });

    const app = createTestApp(db);
    const res = await app.request('/api/novels/11111111-1111-4111-8111-111111111111');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('小説1');
  });

  it('PUT /api/novels/:id → 200 で更新されること', async () => {
    const updated = {
      id: '11111111-1111-4111-8111-111111111111',
      title: '更新後',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updated]),
        }),
      }),
    });

    const app = createTestApp(db);
    const res = await app.request('/api/novels/11111111-1111-4111-8111-111111111111', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '更新後' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('更新後');
  });

  it('DELETE /api/novels/:id → 200 で削除されること', async () => {
    const deleted = {
      id: '11111111-1111-4111-8111-111111111111',
      title: '小説1',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([deleted]),
      }),
    });

    const app = createTestApp(db);
    const res = await app.request('/api/novels/11111111-1111-4111-8111-111111111111', {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
