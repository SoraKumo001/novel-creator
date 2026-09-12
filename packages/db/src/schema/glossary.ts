import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { novels } from "./novels.js";

export const glossaryEntries = pgTable(
  "glossary_entries",
  {
    aliases: jsonb("aliases").$type<string[]>().default([]).notNull(),
    category: text("category").notNull().default("未分類"),
    createdAt: timestamp("created_at").defaultNow(),
    description: text("description"),
    id: uuid("id").primaryKey().defaultRandom(),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    reading: text("reading"),
    term: text("term").notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("glossary_entries_novel_id_idx").on(t.novelId)]
);

export type GlossaryEntry = typeof glossaryEntries.$inferSelect;
export type NewGlossaryEntry = typeof glossaryEntries.$inferInsert;
