import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { novels } from './novels.js';

export const customPrompts = pgTable('custom_prompts', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id').references(() => novels.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon').default('🪄'),
  category: text('category').notNull().default('inline'), // 'inline' | 'generation' | 'chat' | 'general'
  systemPrompt: text('system_prompt'),
  userPrompt: text('user_prompt').notNull(),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type CustomPrompt = typeof customPrompts.$inferSelect;
export type NewCustomPrompt = typeof customPrompts.$inferInsert;
