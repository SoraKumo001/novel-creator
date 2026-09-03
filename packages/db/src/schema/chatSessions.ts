import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { novels } from "./novels.js";

/**
 * 相談セッションの権限モード。
 * - consult: 読み取りのみ（既定）
 * - suggest: 編集提案（適用にはユーザー承認が必須）
 * - edit: 自動適用（本文・削除は常に承認必須）
 */
export const CHAT_PERMISSION_MODES = ["consult", "suggest", "edit"] as const;
export type ChatPermissionMode = (typeof CHAT_PERMISSION_MODES)[number];

export const chatSessions = pgTable(
  "chat_sessions",
  {
    createdAt: timestamp("created_at").defaultNow(),
    id: uuid("id").primaryKey().defaultRandom(),
    novelId: uuid("novel_id").references(() => novels.id, {
      onDelete: "cascade",
    }),
    permissionMode: text("permission_mode").notNull().default("consult"),
    title: text("title").notNull().default("新しい相談"),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("chat_sessions_novel_id_idx").on(t.novelId)]
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * AI SDK UIMessage の parts 配列（テキスト・ツール呼び出し・承認要求などを含む）。
     * Phase 0 では null 許容（従来メッセージはテキストのみ）。
     */
    parts: jsonb("parts"),
    role: text("role").notNull(), // 'user' | 'assistant' | 'tool'
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
  },
  (t) => [index("chat_messages_session_id_idx").on(t.sessionId)]
);

export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
