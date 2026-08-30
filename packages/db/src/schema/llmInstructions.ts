import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { novels } from './novels.js';

export const llmInstructions = pgTable('llm_instructions', {
  id: uuid('id').primaryKey().defaultRandom(),
  novelId: uuid('novel_id')
    .notNull()
    .references(() => novels.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  instruction: text('instruction').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export type LlmInstruction = typeof llmInstructions.$inferSelect;
export type NewLlmInstruction = typeof llmInstructions.$inferInsert;
