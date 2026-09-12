import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { novels } from "./novels.js";

/**
 * MCP API キー発行テーブル。
 * - 発行トークン形式は `mcp_` + 32byte base64url。平文は発行時応答でのみ返し、DB には
 *   SHA-256 ハッシュ (keyHash) と secret-crypto の enc:v1 暗号文 (encryptedKey) を保管する。
 * - novelId が null のキーは全体共有キー。小説スコープのキーは novels 削除時に cascade する。
 * - 失効は revokedAt 設定（物理削除しない）。有効期限は expiresAt（null は無期限）。
 */
export const mcpApiKeys = pgTable(
  "mcp_api_keys",
  {
    createdAt: timestamp("created_at").notNull().defaultNow(),
    encryptedKey: text("encrypted_key").notNull(),
    expiresAt: timestamp("expires_at"),
    id: uuid("id").primaryKey().defaultRandom(),
    keyHash: text("key_hash").notNull().unique(),
    name: text("name").notNull(),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, {
        onDelete: "cascade",
      }),
    prefix: text("prefix").notNull(),
    revokedAt: timestamp("revoked_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("mcp_api_keys_novel_id_idx").on(t.novelId),
    index("mcp_api_keys_user_id_idx").on(t.userId),
  ]
);

export type McpApiKey = typeof mcpApiKeys.$inferSelect;
export type NewMcpApiKey = typeof mcpApiKeys.$inferInsert;
