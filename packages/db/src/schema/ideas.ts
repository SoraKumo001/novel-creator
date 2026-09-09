import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { novels } from "./novels.js";

export const ideaStatuses = ["draft", "adopted", "rejected"] as const;

export type IdeaStatus = (typeof ideaStatuses)[number];

export const ideas = pgTable(
  "ideas",
  {
    body: text("body"),
    createdAt: timestamp("created_at").defaultNow(),
    id: uuid("id").primaryKey().defaultRandom(),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    source: text("source"),
    status: text("status").notNull().default("draft"),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("ideas_novel_id_idx").on(t.novelId)]
);

export type Idea = typeof ideas.$inferSelect;
export type NewIdea = typeof ideas.$inferInsert;
