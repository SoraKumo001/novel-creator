import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { llmProviders } from '@novel-creator/shared';

export const llmConfigs = pgTable('llm_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  provider: text('provider', { enum: [...llmProviders] }).notNull(),
  modelId: text('model_id').notNull(),
  baseUrl: text('base_url'),
  apiKey: text('api_key'),
  isDefault: boolean('is_default').default(false).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type LLMConfig = typeof llmConfigs.$inferSelect;
export type NewLLMConfig = typeof llmConfigs.$inferInsert;
