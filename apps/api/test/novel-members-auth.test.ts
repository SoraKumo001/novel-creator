import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { AppContext } from "../src/context.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { novelMembersRouter } from "../src/routes/novels/members.js";

const NOVEL_ID = "11111111-1111-4111-8111-111111111111";

interface MockDb {
  select: ReturnType<typeof vi.fn>;
}

/**
 * findNovel 用の select().from().where() チェーンを構築する。
 * 1回目の呼び出しは小説本体、2回目以降はメンバー追加対象の検索に使われる。
 */
function createMockDb(targetRows: unknown[]): MockDb {
  const db = {
    select: vi.fn(),
  };
  db.select
    .mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: NOVEL_ID }]),
      }),
    })
    .mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(targetRows),
      }),
    });
  return db;
}

function createTestApp(db: MockDb, env: unknown) {
  const app = new Hono<AppContext>();
  app.use("*", async (c, next) => {
    c.set("env", env as never);
    c.set("db", db as never);
    c.set("llm", {} as never);
    c.set("embedding", {} as never);
    c.set("vectorStore", {} as never);
    await next();
  });
  app.onError(errorHandler);
  app.route("/api/novels", novelMembersRouter);
  return app;
}

describe("novel members assertMemberManage fail-closed", () => {
  it("未設定では素通りせず 401 を返すこと", async () => {
    const app = createTestApp(createMockDb([]), {});
    const res = await app.request(`/api/novels/${NOVEL_ID}/members`, {
      body: JSON.stringify({ role: "editor", userId: "user-1" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("MASTER 設定時は素通りし、後段の判定に進むこと", async () => {
    const app = createTestApp(createMockDb([]), {
      MASTER_SECRET: "test-master-secret-0123456789",
    });
    const res = await app.request(`/api/novels/${NOVEL_ID}/members`, {
      body: JSON.stringify({ role: "editor", userId: "user-1" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    // 対象ユーザーが存在しないため 404。401 でないことが素通りの証明になる。
    expect(res.status).toBe(404);
  });
});
