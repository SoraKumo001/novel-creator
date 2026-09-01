import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const novels = pgTable("novels", {
  createdAt: timestamp("created_at").defaultNow(),
  description: text("description"),
  id: uuid("id").primaryKey().defaultRandom(),
  storyOutline: text("story_outline"),
  styleGuide: text("style_guide"),
  title: text("title").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Novel = typeof novels.$inferSelect;
export type NewNovel = typeof novels.$inferInsert;
