import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { novels } from './novels';

export const chapters = pgTable('chapters', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id')
    .notNull()
    .references(() => novels.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  order: integer('order').notNull(),
  summary: text('summary'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;
