import { zValidator } from "@hono/zod-validator";
import {
  type NovelMemberRole,
  novelMembers,
  novels,
  user,
} from "@novel-creator/db";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";

import type { AppContext } from "../../context.js";
import { isAuthConfigured } from "../../lib/auth.js";
import { assertNovelAccess } from "../../middleware/auth.js";

const novelIdParamSchema = z.object({
  novelId: z.uuid(),
});

const memberParamSchema = z.object({
  novelId: z.uuid(),
  userId: z.string().min(1),
});

const memberRoleInputSchema = z.enum(["owner", "editor", "viewer", "admin"]);

const createMemberSchema = z
  .object({
    email: z.string().email().optional(),
    role: memberRoleInputSchema,
    userId: z.string().min(1).optional(),
  })
  .refine((body) => body.userId !== undefined || body.email !== undefined, {
    message: "userId または email のいずれかを指定してください。",
  });

const updateMemberSchema = z.object({
  role: memberRoleInputSchema,
});

/** フロント互換のため admin は owner に読み替える。 */
function normalizeRole(
  role: z.infer<typeof memberRoleInputSchema>
): NovelMemberRole {
  return role === "admin" ? "owner" : role;
}

function forbidden(c: Context<AppContext>, message: string) {
  return c.json({ error: { code: "FORBIDDEN", message } }, 403);
}

/**
 * メンバー管理権限を要求する（admin または当該 novel の owner のみ）。
 * 認証未設定時・ユーザー未格納時（ルーター単体テスト）は素通りする。
 * 違反時は 403 応答を返す。許可時は null を返す。
 */
async function assertMemberManage(
  c: Context<AppContext>,
  novelId: string
): Promise<Response | null> {
  const env = c.get("env");
  if (!isAuthConfigured(env)) {
    return null;
  }
  const current = c.get("user");
  if (!current) {
    return null;
  }
  if (current.role === "admin") {
    return null;
  }
  const db = c.get("db");
  const [owner] = await db
    .select({ id: novelMembers.id })
    .from(novelMembers)
    .where(
      and(
        eq(novelMembers.novelId, novelId),
        eq(novelMembers.userId, current.id),
        eq(novelMembers.role, "owner")
      )
    );
  if (!owner) {
    return forbidden(c, "Novel owner or admin only");
  }
  return null;
}

async function findNovel(c: Context<AppContext>, novelId: string) {
  const [novel] = await c
    .get("db")
    .select({ id: novels.id })
    .from(novels)
    .where(eq(novels.id, novelId));
  return novel ?? null;
}

async function countOwners(
  c: Context<AppContext>,
  novelId: string
): Promise<number> {
  const owners = await c
    .get("db")
    .select({ id: novelMembers.id })
    .from(novelMembers)
    .where(
      and(eq(novelMembers.novelId, novelId), eq(novelMembers.role, "owner"))
    );
  return owners.length;
}

export const novelMembersRouter = new Hono<AppContext>()
  // GET /api/novels/:novelId/members - メンバー一覧
  .get(
    "/:novelId/members",
    zValidator("param", novelIdParamSchema),
    async (c) => {
      const { novelId } = c.req.valid("param");
      const denied = await assertNovelAccess(c, novelId);
      if (denied) {
        return denied;
      }
      const novel = await findNovel(c, novelId);
      if (!novel) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "Novel not found" } },
          404
        );
      }
      const rows = await c
        .get("db")
        .select({
          email: user.email,
          role: novelMembers.role,
          userId: novelMembers.userId,
        })
        .from(novelMembers)
        .innerJoin(user, eq(novelMembers.userId, user.id))
        .where(eq(novelMembers.novelId, novelId));
      return c.json(rows);
    }
  )
  // POST /api/novels/:novelId/members - メンバー追加（admin または当該 novel の owner のみ）
  .post(
    "/:novelId/members",
    zValidator("param", novelIdParamSchema),
    zValidator("json", createMemberSchema),
    async (c) => {
      const { novelId } = c.req.valid("param");
      const body = c.req.valid("json");
      const novel = await findNovel(c, novelId);
      if (!novel) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "Novel not found" } },
          404
        );
      }
      const denied = await assertMemberManage(c, novelId);
      if (denied) {
        return denied;
      }
      const db = c.get("db");
      const [target] = body.userId
        ? await db
            .select({ email: user.email, id: user.id })
            .from(user)
            .where(eq(user.id, body.userId))
        : await db
            .select({ email: user.email, id: user.id })
            .from(user)
            .where(eq(user.email, body.email as string));
      if (!target) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "User not found" } },
          404
        );
      }
      const [existing] = await db
        .select({ id: novelMembers.id })
        .from(novelMembers)
        .where(
          and(
            eq(novelMembers.novelId, novelId),
            eq(novelMembers.userId, target.id)
          )
        );
      if (existing) {
        return c.json(
          { error: { code: "CONFLICT", message: "Member already exists" } },
          409
        );
      }
      const role = normalizeRole(body.role);
      const [created] = await db
        .insert(novelMembers)
        .values({ novelId, role, userId: target.id })
        .returning({ role: novelMembers.role, userId: novelMembers.userId });
      if (!created) {
        return c.json(
          {
            error: {
              code: "INTERNAL_ERROR",
              message: "メンバーの追加に失敗しました。",
            },
          },
          500
        );
      }
      return c.json(
        { email: target.email, role: created.role, userId: created.userId },
        201
      );
    }
  )
  // PATCH /api/novels/:novelId/members/:userId - 権限変更（admin または当該 novel の owner のみ）
  .patch(
    "/:novelId/members/:userId",
    zValidator("param", memberParamSchema),
    zValidator("json", updateMemberSchema),
    async (c) => {
      const { novelId, userId } = c.req.valid("param");
      const body = c.req.valid("json");
      const novel = await findNovel(c, novelId);
      if (!novel) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "Novel not found" } },
          404
        );
      }
      const denied = await assertMemberManage(c, novelId);
      if (denied) {
        return denied;
      }
      const db = c.get("db");
      const [existing] = await db
        .select({ role: novelMembers.role, userId: novelMembers.userId })
        .from(novelMembers)
        .where(
          and(
            eq(novelMembers.novelId, novelId),
            eq(novelMembers.userId, userId)
          )
        );
      if (!existing) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "Member not found" } },
          404
        );
      }
      const role = normalizeRole(body.role);
      if (
        existing.role === "owner" &&
        role !== "owner" &&
        (await countOwners(c, novelId)) <= 1
      ) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "最後の owner の権限は変更できません。",
            },
          },
          400
        );
      }
      const [updated] = await db
        .update(novelMembers)
        .set({ role })
        .where(
          and(
            eq(novelMembers.novelId, novelId),
            eq(novelMembers.userId, userId)
          )
        )
        .returning({ role: novelMembers.role, userId: novelMembers.userId });
      if (!updated) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "Member not found" } },
          404
        );
      }
      const [target] = await db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, userId));
      return c.json({
        email: target?.email ?? null,
        role: updated.role,
        userId: updated.userId,
      });
    }
  )
  // DELETE /api/novels/:novelId/members/:userId - メンバー削除（admin または当該 novel の owner のみ）
  .delete(
    "/:novelId/members/:userId",
    zValidator("param", memberParamSchema),
    async (c) => {
      const { novelId, userId } = c.req.valid("param");
      const novel = await findNovel(c, novelId);
      if (!novel) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "Novel not found" } },
          404
        );
      }
      const denied = await assertMemberManage(c, novelId);
      if (denied) {
        return denied;
      }
      const db = c.get("db");
      const [existing] = await db
        .select({ role: novelMembers.role })
        .from(novelMembers)
        .where(
          and(
            eq(novelMembers.novelId, novelId),
            eq(novelMembers.userId, userId)
          )
        );
      if (!existing) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "Member not found" } },
          404
        );
      }
      if (existing.role === "owner" && (await countOwners(c, novelId)) <= 1) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "最後の owner は削除できません。",
            },
          },
          400
        );
      }
      await db
        .delete(novelMembers)
        .where(
          and(
            eq(novelMembers.novelId, novelId),
            eq(novelMembers.userId, userId)
          )
        );
      return c.json({ success: true });
    }
  );
