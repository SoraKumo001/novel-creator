import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { novels } from "./novels.js";

export const customPrompts = pgTable("custom_prompts", {
  category: text("category", {
    enum: ["inline", "generation", "chat", "general"],
  })
    .notNull()
    .default("inline"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  description: text("description"),
  icon: text("icon").default("🪄"),
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  novelId: uuid("novel_id").references(() => novels.id, {
    onDelete: "cascade",
  }),
  order: integer("order").notNull().default(0),
  systemPrompt: text("system_prompt"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  userPrompt: text("user_prompt").notNull(),
});

export type CustomPrompt = typeof customPrompts.$inferSelect;
export type NewCustomPrompt = typeof customPrompts.$inferInsert;
