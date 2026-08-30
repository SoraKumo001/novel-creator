import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { novels } from './novels.js';
import { sections } from './sections.js';

export const timelines = pgTable('timelines', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id')
    .notNull()
    .references(() => novels.id, { onDelete: 'cascade' }),
  sectionId: uuid('section_id').references(() => sections.id, {
    onDelete: 'set null',
  }),
  event: text('event').notNull(),
  order: integer('order').notNull(),
  timestamp: text('timestamp'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type Timeline = typeof timelines.$inferSelect;
export type NewTimeline = typeof timelines.$inferInsert;
