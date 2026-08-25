import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { novels } from './novels';

export const characters = pgTable('characters', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id')
    .notNull()
    .references(() => novels.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  traits: jsonb('traits').$type<string[]>(),
  relationships: jsonb('relationships'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
