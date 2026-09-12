import { llmProviders } from "@novel-creator/shared";
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const llmConfigs = pgTable("llm_configs", {
  // NOTE(S0-1): api_key は AES-GCM 暗号文 ("enc:v1:...") またはレガシー平文を格納する。
  // カラム型は text のまま。復号はサーバ内 (secret-crypto 経由の LLM クライアント構築時) のみで行い、
  // 生のキーを API 応答に含めてはならない。
  apiKey: text("api_key"),
  baseUrl: text("base_url"),
  createdAt: timestamp("created_at").defaultNow(),
  description: text("description"),
  id: uuid("id").primaryKey().defaultRandom(),
  isDefault: boolean("is_default").default(false).notNull(),
  modelId: text("model_id").notNull(),
  name: text("name").notNull(),
  provider: text("provider", { enum: [...llmProviders] }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
});

export type LLMConfig = typeof llmConfigs.$inferSelect;
export type NewLLMConfig = typeof llmConfigs.$inferInsert;
