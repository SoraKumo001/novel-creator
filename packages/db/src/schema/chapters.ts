import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { novels } from "./novels.js";

export const chapters = pgTable("chapters", {
  createdAt: timestamp("created_at").defaultNow(),
  id: uuid("id").primaryKey().defaultRandom(),
  novelId: uuid("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  summary: text("summary"),
  title: text("title").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;
