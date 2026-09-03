import { z } from "zod";

export const createChatSessionSchema = z.object({
  novelId: z.string().uuid().optional(),
  title: z.string().optional(),
});

export const updateChatSessionSchema = z.object({
  title: z.string().min(1),
});

export const chatSessionQuerySchema = z.object({
  novelId: z.string().uuid().optional(),
});

export const chatMessageSchema = z.object({
  content: z.string(),
  role: z.enum(["user", "assistant", "system"]),
});

/**
 * AI SDK UIMessage の疎な zod スキーマ。
 * parts は { type: string } を最低限検証し、それ以外のフィールドは passthrough で許容する。
 * id は省略可能（サーバーは DB 履歴を正史とするため、クライアントの id は信用しない）。
 */
export const uiMessageSchema = z.object({
  id: z.string().optional(),
  parts: z.array(z.object({ type: z.string() }).passthrough()),
  role: z.enum(["user", "assistant", "system"]),
});

export const chatRequestSchema = z.object({
  messages: z.array(uiMessageSchema).min(1),
  modelConfigId: z.string().uuid().optional().nullable(),
  novelId: z.string().uuid().optional().nullable(),
  sessionId: z.string().uuid(),
});

export const extractChatEntitiesSchema = z.object({
  text: z.string().min(1),
});
