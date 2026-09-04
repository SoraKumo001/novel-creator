import { zValidator } from "@hono/zod-validator";
import { user } from "@novel-creator/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { AppContext } from "../context.js";
import { createAuth } from "../lib/auth.js";
import { requireAdmin } from "../middleware/auth.js";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100).optional(),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "user"]).optional(),
});

const updateUserSchema = z
  .object({
    disabled: z.boolean().optional(),
    role: z.enum(["admin", "user"]).optional(),
  })
  .refine((body) => body.disabled !== undefined || body.role !== undefined, {
    message: "role または disabled のいずれかを指定してください。",
  });

const userIdParamSchema = z.object({
  id: z.string().min(1),
});

interface UserRow {
  banned: boolean | null;
  createdAt: Date | null;
  email: string;
  id: string;
  name: string | null;
  role: string | null;
}

/**
 * DB 行をフロント期待の AdminUser 形状に整形する。
 * disabled=banned、createdAt=ISO 文字列に変換する。
 */
function toAdminUser(row: UserRow) {
  return {
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : null,
    disabled: row.banned ?? null,
    email: row.email,
    id: row.id,
    name: row.name,
    role: row.role === "admin" ? "admin" : "user",
  };
}

const userColumns = {
  banned: user.banned,
  createdAt: user.createdAt,
  email: user.email,
  id: user.id,
  name: user.name,
  role: user.role,
} as const;

// ユーザー管理は admin 限定とする。
const usersRouter = new Hono<AppContext>()
  .use(requireAdmin)
  // GET /api/users - ユーザー一覧取得
  .get("/", async (c) => {
    const rows = await c.get("db").select(userColumns).from(user);
    return c.json(rows.map(toAdminUser));
  })
  // POST /api/users - ユーザー作成（admin のみ）
  .post("/", zValidator("json", createUserSchema), async (c) => {
    const body = c.req.valid("json");
    const db = c.get("db");
    const auth = createAuth(c.get("env"), db);
    const createUser = auth.api.createUser as unknown as (args: {
      body: { email: string; name: string; password: string; role?: string };
      headers: Headers;
    }) => Promise<{ user: { id: string } }>;
    try {
      const result = await createUser({
        body: {
          email: body.email,
          name: body.name ?? (body.email.split("@")[0] || body.email),
          password: body.password,
          role: body.role ?? "user",
        },
        headers: c.req.raw.headers,
      });
      if (body.role) {
        await db
          .update(user)
          .set({ role: body.role })
          .where(eq(user.id, result.user.id));
      }
      const [created] = await db
        .select(userColumns)
        .from(user)
        .where(eq(user.id, result.user.id));
      if (!created) {
        return c.json(
          {
            error: {
              code: "INTERNAL_ERROR",
              message: "ユーザーの作成に失敗しました。",
            },
          },
          500
        );
      }
      return c.json({ user: toAdminUser(created) }, 201);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "ユーザーの作成に失敗しました。";
      return c.json({ error: { code: "VALIDATION_ERROR", message } }, 400);
    }
  })
  // PATCH /api/users/:id - role / disabled 更新（admin のみ）
  .patch(
    "/:id",
    zValidator("param", userIdParamSchema),
    zValidator("json", updateUserSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const current = c.get("user");
      if (
        current &&
        current.id === id &&
        (body.role === "user" || body.disabled === true)
      ) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "自分自身の管理者権限剥奪・無効化はできません。",
            },
          },
          400
        );
      }
      const db = c.get("db");
      const [existing] = await db
        .select(userColumns)
        .from(user)
        .where(eq(user.id, id));
      if (!existing) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "User not found" } },
          404
        );
      }
      const [updated] = await db
        .update(user)
        .set({
          ...(body.role === undefined ? {} : { role: body.role }),
          ...(body.disabled === undefined ? {} : { banned: body.disabled }),
        })
        .where(eq(user.id, id))
        .returning(userColumns);
      if (!updated) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "User not found" } },
          404
        );
      }
      return c.json({ user: toAdminUser(updated) });
    }
  );

export default usersRouter;
