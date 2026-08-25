import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { chapters } from './chapters';

export const sections = pgTable('sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  chapterId: uuid('chapter_id')
    .notNull()
    .references(() => chapters.id, { onDelete: 'cascade' }),
  title: text('title'),
  order: integer('order').notNull(),
  summary: text('summary'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type Section = typeof sections.$inferSelect;
export type NewSection = typeof sections.$inferInsert;
