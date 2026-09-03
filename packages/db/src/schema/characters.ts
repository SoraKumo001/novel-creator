import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { novels } from "./novels.js";

export const characters = pgTable(
  "characters",
  {
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
  },
  (t) => [index("characters_novel_id_idx").on(t.novelId)]
);

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
