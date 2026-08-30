import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { novels } from './novels';

/**
 * AI 分析結果（ストーリーアーク / 口調チェック / ペルソナレビュー）の保存テーブル。
 * result には各分析の JSON ペイロードをそのまま保存する。
 */
export const analysisResults = pgTable('analysis_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id')
    .notNull()
    .references(() => novels.id, { onDelete: 'cascade' }),
  analysisType: text('analysis_type').notNull(), // 'story-arc' | 'check-voice' | 'persona-review'
  targetSectionId: uuid('target_section_id'),
  targetChapterId: uuid('target_chapter_id'),
  result: jsonb('result').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export type AnalysisResultRow = typeof analysisResults.$inferSelect;
export type NewAnalysisResultRow = typeof analysisResults.$inferInsert;
