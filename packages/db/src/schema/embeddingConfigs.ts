import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { llmProviders } from '@novel-creator/shared';

export const embeddingConfigs = pgTable('embedding_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  provider: text('provider', { enum: [...llmProviders] }).notNull(),
  modelId: text('model_id').notNull(),
  dimensions: integer('dimensions').notNull().default(1536),
  baseUrl: text('base_url'),
  apiKey: text('api_key'),
  isDefault: boolean('is_default').default(false).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type EmbeddingConfig = typeof embeddingConfigs.$inferSelect;
export type NewEmbeddingConfig = typeof embeddingConfigs.$inferInsert;
