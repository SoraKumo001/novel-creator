import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { sections } from './sections';

export const contents = pgTable('contents', {
  id: uuid('id').primaryKey().defaultRandom(),
  sectionId: uuid('section_id')
    .notNull()
    .references(() => sections.id, { onDelete: 'cascade' })
    .unique(),
  body: text('body').notNull(),
  wordCount: integer('word_count'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type Content = typeof contents.$inferSelect;
export type NewContent = typeof contents.$inferInsert;
