import { chatMessages, chatSessions } from "@novel-creator/db";
import { asc, desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import type { chatRequestSchema } from "../../schemas/index.js";
import {
  NotFoundError,
  type ServiceContext,
  ValidationError,
} from "../types.js";

export async function ensureChatSession(
  ctx: ServiceContext,
  sessionId: string
) {
  const [session] = await ctx.db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId));
  if (!session) {
    throw new NotFoundError("Chat session not found");
  }
  return session;
}

export async function listChatSessions(ctx: ServiceContext, novelId?: string) {
  return novelId
    ? ctx.db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.novelId, novelId))
        .orderBy(desc(chatSessions.updatedAt))
    : ctx.db
        .select()
        .from(chatSessions)
        .where(isNull(chatSessions.novelId))
        .orderBy(desc(chatSessions.updatedAt));
}

export async function getChatSessionWithMessages(
  ctx: ServiceContext,
  id: string
) {
  const [session] = await ctx.db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, id));
  if (!session) {
    throw new NotFoundError("Chat session not found");
  }
  const messages = await ctx.db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, id))
    .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));

  return {
    messages,
    session,
  };
}

export async function createChatSession(
  ctx: ServiceContext,
  data: {
    novelId?: string | null;
    title?: string;
    messages?: { role: "user" | "assistant"; content: string }[];
  }
) {
  const [session] = await ctx.db
    .insert(chatSessions)
    .values({
      novelId: data.novelId || null,
      title: data.title?.trim() || "新しい相談",
    })
    .returning();

  if (data.messages && data.messages.length > 0) {
    await ctx.db.insert(chatMessages).values(
      data.messages.map((m) => ({
        content: m.content,
        role: m.role,
        sessionId: session.id,
      }))
    );
  }

  return session;
}

export async function updateChatSession(
  ctx: ServiceContext,
  id: string,
  data: { title?: string }
) {
  const [updated] = await ctx.db
    .update(chatSessions)
    .set({
      ...(data.title ? { title: data.title.trim() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(chatSessions.id, id))
    .returning();

  if (!updated) {
    throw new NotFoundError("Chat session not found");
  }

  return updated;
}

export async function deleteChatSession(ctx: ServiceContext, id: string) {
  const [deleted] = await ctx.db
    .delete(chatSessions)
    .where(eq(chatSessions.id, id))
    .returning();
  if (!deleted) {
    throw new NotFoundError("Chat session not found");
  }
  return deleted;
}

/**
 * リトライ時の重複保存を防ぐ猶予（ミリ秒）。直前の user メッセージと同文かつ
 * この時間以内の再送は再保存せず既存行を再利用する。
 */
export const CHAT_USER_DEDUP_WINDOW_MS = 30_000;

/**
 * リクエストの messages から最後の role='user' メッセージのみを採用し、
 * ストリーム開始前に DB へ永続化してセッションの updatedAt を更新する。
 *
 * 冪等ガード: 直前の user メッセージと同文かつ CHAT_USER_DEDUP_WINDOW_MS 以内の
 * 再送は insert をスキップする。これによりリトライ／二重送信での重複保存と、
 * abort により assistant 未生成のまま残った孤児 user メッセージの再利用
 * （同じ文面のリトライは新規行を作らず既存行に対応する assistant を紐付ける）
 * を軽量に実現する。大規模な冪等キー導入は行わない。
 */
export async function persistChatUserMessage(
  ctx: ServiceContext,
  sessionId: string,
  messages: z.infer<typeof chatRequestSchema>["messages"]
) {
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  if (!lastUserMessage) {
    throw new ValidationError("No user message provided");
  }
  const userText = lastUserMessage.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text?: string }).text ?? "")
    .join("");

  const isDuplicate = await isRecentDuplicateUserMessage(
    ctx,
    sessionId,
    userText
  );
  if (!isDuplicate) {
    await ctx.db.insert(chatMessages).values({
      content: userText,
      parts: lastUserMessage.parts,
      role: "user",
      sessionId,
    });
  }
  await ctx.db
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));

  return { userText };
}

/**
 * 直近の user メッセージと同文かつ猶予時間内かをベストエフォートで判定する。
 * 履歴取得に失敗した場合は重複なしとして通常保存にフォールバックする。
 */
async function isRecentDuplicateUserMessage(
  ctx: ServiceContext,
  sessionId: string,
  userText: string
): Promise<boolean> {
  try {
    const rows = await ctx.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id));
    const userRows = rows.filter((m) => m.role === "user");
    if (userRows.length === 0) {
      return false;
    }
    // 取得順（asc/desc）に依存せず、createdAt が最も新しい user 行を直前とみなす。
    // createdAt が欠損している場合は配列末尾を直前とする。
    const lastUser = userRows.reduce((latest, current) =>
      getMessageTime(current.createdAt) >= getMessageTime(latest.createdAt)
        ? current
        : latest
    );
    if (lastUser.content !== userText) {
      return false;
    }
    const createdAt = getMessageTime(lastUser.createdAt);
    if (Number.isNaN(createdAt)) {
      return false;
    }
    return Date.now() - createdAt < CHAT_USER_DEDUP_WINDOW_MS;
  } catch {
    return false;
  }
}

function getMessageTime(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value).getTime();
  }
  return Number.NaN;
}
