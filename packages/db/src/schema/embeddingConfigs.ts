import { llmProviders } from "@novel-creator/shared";
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const embeddingConfigs = pgTable("embedding_configs", {
  // NOTE(S0-1): api_key は AES-GCM 暗号文 ("enc:v1:...") またはレガシー平文を格納する。
  // カラム型は text のまま。復号はサーバ内 (secret-crypto 経由の Embedding クライアント構築時) のみで行い、
  // 生のキーを API 応答に含めてはならない。
  apiKey: text("api_key"),
  baseUrl: text("base_url"),
  createdAt: timestamp("created_at").defaultNow(),
  description: text("description"),
  // デフォルト次元は @novel-creator/vector の DEFAULT_VECTOR_DIMENSIONS (3072) と同期させること。
  dimensions: integer("dimensions").notNull().default(3072),
  id: uuid("id").primaryKey().defaultRandom(),
  isDefault: boolean("is_default").default(false).notNull(),
  modelId: text("model_id").notNull(),
  name: text("name").notNull(),
  provider: text("provider", { enum: [...llmProviders] }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type EmbeddingConfig = typeof embeddingConfigs.$inferSelect;
export type NewEmbeddingConfig = typeof embeddingConfigs.$inferInsert;
