import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { novels } from "./novels.js";

export const settings = pgTable(
  "settings",
  {
    category: text("category").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    description: text("description"),
    id: uuid("id").primaryKey().defaultRandom(),
    metadata: jsonb("metadata"),
    name: text("name").notNull(),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("settings_novel_id_idx").on(t.novelId)]
);

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
