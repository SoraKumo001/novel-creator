import {
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { novels } from "./novels.js";

export interface ConsistencyViolation {
  excerpt: string;
  kind: string;
  suggestion: string;
  term: string;
}

/**
 * 用語集整合性チェック結果（節単位・同期・最小）。
 * 全体分析は対象外。world_facts は作らない。
 */
export const consistencyReports = pgTable(
  "consistency_reports",
  {
    createdAt: timestamp("created_at").defaultNow(),
    id: uuid("id").primaryKey().defaultRandom(),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    ok: boolean("ok").notNull(),
    targetSectionId: uuid("target_section_id"),
    violations: jsonb("violations")
      .$type<ConsistencyViolation[]>()
      .default([])
      .notNull(),
  },
  (t) => [index("consistency_reports_novel_id_idx").on(t.novelId)]
);

export type ConsistencyReport = typeof consistencyReports.$inferSelect;
export type NewConsistencyReport = typeof consistencyReports.$inferInsert;
