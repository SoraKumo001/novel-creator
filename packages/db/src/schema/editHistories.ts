import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { novels } from './novels';

export const editHistories = pgTable('edit_histories', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id')
    .notNull()
    .references(() => novels.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(), // 'content' | 'character' | 'setting' | 'characters_markdown' | 'settings_markdown'
  entityId: text('entity_id').notNull(), // sectionId, characterId, settingId, or novelId
  title: text('title').notNull().default(''),
  content: text('content').notNull(), // 本文、マークダウン、またはJSON文字列
  description: text('description').notNull().default('手動保存'),
  wordCount: integer('word_count'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type EditHistory = typeof editHistories.$inferSelect;
export type NewEditHistory = typeof editHistories.$inferInsert;
