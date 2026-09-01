import { foreshadowingStatuses } from "@novel-creator/shared";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { novels } from "./novels.js";
import { sections } from "./sections.js";

export const foreshadowings = pgTable("foreshadowings", {
  category: text("category").notNull().default("未分類"),
  createdAt: timestamp("created_at").defaultNow(),
  description: text("description"),
  id: uuid("id").primaryKey().defaultRandom(),
  novelId: uuid("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  placedSectionId: uuid("placed_section_id").references(() => sections.id, {
    onDelete: "set null",
  }),
  resolvedSectionId: uuid("resolved_section_id").references(() => sections.id, {
    onDelete: "set null",
  }),
  status: text("status", { enum: [...foreshadowingStatuses] })
    .notNull()
    .default("unresolved"),
  title: text("title").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Foreshadowing = typeof foreshadowings.$inferSelect;
export type NewForeshadowing = typeof foreshadowings.$inferInsert;
