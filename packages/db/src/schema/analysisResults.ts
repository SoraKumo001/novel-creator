import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { novels } from "./novels.js";

/**
 * AI 分析結果（ストーリーアーク / 口調チェック / ペルソナレビュー）の保存テーブル。
 * result には各分析の JSON ペイロードをそのまま保存する。
 */
export const analysisResults = pgTable(
  "analysis_results",
  {
    analysisType: text("analysis_type").notNull(), // 'story-arc' | 'check-voice' | 'persona-review'
    createdAt: timestamp("created_at").defaultNow(),
    id: uuid("id").primaryKey().defaultRandom(),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    result: jsonb("result").notNull(),
    targetChapterId: uuid("target_chapter_id"),
    targetSectionId: uuid("target_section_id"),
  },
  (t) => [index("analysis_results_novel_id_idx").on(t.novelId)]
);

export type AnalysisResultRow = typeof analysisResults.$inferSelect;
export type NewAnalysisResultRow = typeof analysisResults.$inferInsert;
