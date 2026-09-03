import { z } from "zod";

export const createChatSessionSchema = z.object({
  novelId: z.string().uuid().optional(),
  title: z.string().max(100).optional(),
});

export const updateChatSessionSchema = z.object({
  title: z.string().min(1).max(100),
});

export const chatSessionQuerySchema = z.object({
  novelId: z.string().uuid().optional(),
});

export const chatMessageSchema = z.object({
  content: z.string().max(8000),
  role: z.enum(["user", "assistant", "system"]),
});

/**
 * AI SDK UIMessage の疎な zod スキーマ。
 * parts は { type: string } を最低限検証し、それ以外のフィールドは passthrough で許容する。
 * id は省略可能（サーバーは DB 履歴を正史とするため、クライアントの id は信用しない）。
 * チャット送信は role='user' のみ受け付ける（assistant/system の偽装を拒否）。
 */
export const uiMessageSchema = z.object({
  id: z.string().optional(),
  parts: z
    .array(
      z
        .object({ text: z.string().max(8000).optional(), type: z.string() })
        .passthrough()
    )
    .max(20),
  role: z.literal("user"),
});

export const chatRequestSchema = z.object({
  messages: z.array(uiMessageSchema).min(1).max(50),
  modelConfigId: z.string().uuid().optional().nullable(),
  novelId: z.string().uuid().optional().nullable(),
  sessionId: z.string().uuid(),
});

export const extractChatEntitiesSchema = z.object({
  text: z.string().min(1).max(8000),
});
