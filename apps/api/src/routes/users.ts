import { zValidator } from "@hono/zod-validator";
import { user } from "@novel-creator/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { AppContext } from "../context.js";
import { requireAdmin } from "../middleware/auth.js";

const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "ユーザー名を入力してください。")
    .max(50, "ユーザー名は50文字以内で入力してください。"),
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

const usersRouter = new Hono<AppContext>()
  // PATCH /api/users/me - 自身のユーザー名（表示名）更新（全ログインユーザー）
  .patch("/me", zValidator("json", updateProfileSchema), async (c) => {
    const current = c.get("user");
    if (!current?.id) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        401
      );
    }
    const { name } = c.req.valid("json");
    const db = c.get("db");
    const [updated] = await db
      .update(user)
      .set({
        name,
        updatedAt: new Date(),
      })
      .where(eq(user.id, current.id))
      .returning(userColumns);

    if (!updated) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        404
      );
    }
    return c.json({ user: toAdminUser(updated) });
  })
  // 以下のユーザー管理は admin 限定とする。
  .use(requireAdmin)
  // GET /api/users - ユーザー一覧取得
  .get("/", async (c) => {
    const rows = await c.get("db").select(userColumns).from(user);
    return c.json(rows.map(toAdminUser));
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
