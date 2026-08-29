import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { foreshadowingStatuses } from '@novel-creator/shared';
import { novels } from './novels.js';
import { sections } from './sections.js';

export const foreshadowings = pgTable('foreshadowings', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id')
    .notNull()
    .references(() => novels.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: [...foreshadowingStatuses] })
    .notNull()
    .default('unresolved'),
  placedSectionId: uuid('placed_section_id').references(() => sections.id, {
    onDelete: 'set null',
  }),
  resolvedSectionId: uuid('resolved_section_id').references(() => sections.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type Foreshadowing = typeof foreshadowings.$inferSelect;
export type NewForeshadowing = typeof foreshadowings.$inferInsert;
