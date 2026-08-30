import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const novels = pgTable('novels', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  styleGuide: text('style_guide'),
  storyOutline: text('story_outline'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type Novel = typeof novels.$inferSelect;
export type NewNovel = typeof novels.$inferInsert;
