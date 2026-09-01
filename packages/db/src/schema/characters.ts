import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { novels } from "./novels.js";

export const characters = pgTable("characters", {
  category: text("category").notNull().default("未分類"),
  createdAt: timestamp("created_at").defaultNow(),
  description: text("description"),
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  novelId: uuid("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  relationships: jsonb("relationships"),
  traits: jsonb("traits").$type<string[]>(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
