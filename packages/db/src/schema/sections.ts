import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { chapters } from "./chapters.js";

export const sections = pgTable(
  "sections",
  {
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
    id: uuid("id").primaryKey().defaultRandom(),
    order: integer("order").notNull(),
    summary: text("summary"),
    title: text("title"),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("sections_chapter_id_idx").on(t.chapterId)]
);

export type Section = typeof sections.$inferSelect;
export type NewSection = typeof sections.$inferInsert;
