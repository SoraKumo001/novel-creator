import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { novels } from "./novels.js";
import { sections } from "./sections.js";

export const timelines = pgTable("timelines", {
  createdAt: timestamp("created_at").defaultNow(),
  event: text("event").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  novelId: uuid("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  sectionId: uuid("section_id").references(() => sections.id, {
    onDelete: "set null",
  }),
  timestamp: text("timestamp"),
});

export type Timeline = typeof timelines.$inferSelect;
export type NewTimeline = typeof timelines.$inferInsert;
