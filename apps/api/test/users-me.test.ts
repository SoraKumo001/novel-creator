import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext, AuthUser } from "../src/context.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import usersRouter from "../src/routes/users.js";

interface MockDb {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

function createMockDb(): MockDb {
  return {
    select: vi.fn(),
    update: vi.fn(),
  };
}

function createTestApp(db: MockDb, currentUser: AuthUser | null = null) {
  const app = new Hono<AppContext>();
  app.use("*", async (c, next) => {
    c.set("env", { MASTER_SECRET: "test-master-secret-0123456789" } as never);
    c.set("db", db as never);
    if (currentUser) {
      c.set("user", currentUser);
    }
    await next();
  });
  app.onError(errorHandler);
  app.route("/api/users", usersRouter);
  return app;
}

describe("PATCH /api/users/me", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
  });

  it("ログイン中の一般ユーザーが自身のユーザー名を更新できること", async () => {
    const currentUser: AuthUser = {
      id: "user-1",
      email: "user@example.com",
      emailVerified: false,
      image: null,
      name: "旧ユーザー名",
      role: "user",
    };

    const updatedRow = {
      id: "user-1",
      email: "user@example.com",
      name: "新しいユーザー名",
      role: "user",
      banned: false,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    };

    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedRow]),
        }),
      }),
    });

    const app = createTestApp(db, currentUser);
    const res = await app.request("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "新しいユーザー名" }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { user: { id: string; name: string } };
    expect(data.user.id).toBe("user-1");
    expect(data.user.name).toBe("新しいユーザー名");
  });

  it("前後の空白がトリムされて保存されること", async () => {
    const currentUser: AuthUser = {
      id: "user-1",
      email: "user@example.com",
      emailVerified: false,
      image: null,
      name: "旧ユーザー名",
      role: "user",
    };

    const setFn = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: "user-1",
            email: "user@example.com",
            name: "トリムされる名前",
            role: "user",
            banned: false,
            createdAt: new Date(),
          },
        ]),
      }),
    });

    db.update.mockReturnValue({ set: setFn });

    const app = createTestApp(db, currentUser);
    const res = await app.request("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "  トリムされる名前  " }),
    });

    expect(res.status).toBe(200);
    expect(setFn).toHaveBeenCalledWith(
      expect.objectContaining({ name: "トリムされる名前" })
    );
  });

  it("未認証の場合は 401 を返すこと", async () => {
    const app = createTestApp(db, null);
    const res = await app.request("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "新ユーザー名" }),
    });

    expect(res.status).toBe(401);
  });

  it("空文字または空白のみの場合は 400 を返すこと", async () => {
    const currentUser: AuthUser = {
      id: "user-1",
      email: "user@example.com",
      emailVerified: false,
      image: null,
      name: "現ユーザー名",
      role: "user",
    };

    const app = createTestApp(db, currentUser);
    const res = await app.request("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });

    expect(res.status).toBe(400);
  });

  it("50文字を超える場合は 400 を返すこと", async () => {
    const currentUser: AuthUser = {
      id: "user-1",
      email: "user@example.com",
      emailVerified: false,
      image: null,
      name: "現ユーザー名",
      role: "user",
    };

    const app = createTestApp(db, currentUser);
    const res = await app.request("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "あ".repeat(51) }),
    });

    expect(res.status).toBe(400);
  });
});
