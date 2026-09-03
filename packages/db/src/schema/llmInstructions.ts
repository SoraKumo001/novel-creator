import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { novels } from "./novels.js";

export const llmInstructions = pgTable(
  "llm_instructions",
  {
    createdAt: timestamp("created_at").defaultNow(),
    entityType: text("entity_type").notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    instruction: text("instruction").notNull(),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
  },
  (t) => [index("llm_instructions_novel_id_idx").on(t.novelId)]
);

export type LlmInstruction = typeof llmInstructions.$inferSelect;
export type NewLlmInstruction = typeof llmInstructions.$inferInsert;
