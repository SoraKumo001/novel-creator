import { llmProviders } from "@novel-creator/shared";
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const llmConfigs = pgTable("llm_configs", {
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
});

export type LLMConfig = typeof llmConfigs.$inferSelect;
export type NewLLMConfig = typeof llmConfigs.$inferInsert;
