import { chatMessages, chatSessions } from "@novel-creator/db";
import { desc, eq, isNull } from "drizzle-orm";
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
    .orderBy(chatMessages.createdAt);

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
 * リクエストの messages から最後の role='user' メッセージのみを採用し、
 * ストリーム開始前に DB へ永続化してセッションの updatedAt を更新する。
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

  await ctx.db.insert(chatMessages).values({
    content: userText,
    parts: lastUserMessage.parts,
    role: "user",
    sessionId,
  });
  await ctx.db
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));

  return { userText };
}
