import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sections } from "./sections.js";

export const contents = pgTable("contents", {
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  id: uuid("id").primaryKey().defaultRandom(),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => sections.id, { onDelete: "cascade" })
    .unique(),
  updatedAt: timestamp("updated_at").defaultNow(),
  wordCount: integer("word_count"),
});

export type Content = typeof contents.$inferSelect;
export type NewContent = typeof contents.$inferInsert;
