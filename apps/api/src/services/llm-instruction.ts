import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import { and, desc, eq } from 'drizzle-orm';
import { llmInstructions } from '@novel-creator/db';
import { LlmInstructionService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';

function formatLlmInstruction(row: typeof llmInstructions.$inferSelect) {
  return {
    id: row.id,
    novelId: row.novelId,
    entityType: row.entityType,
    entityId: undefined,
    instruction: row.instruction,
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    updatedAt: undefined,
  };
}

export function registerLlmInstructionService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(LlmInstructionService, {
    async listLlmInstructions(req) {
      const db = getContext().db;
      const conditions = [eq(llmInstructions.novelId, req.novelId)];
      if (req.entityType) {
        conditions.push(eq(llmInstructions.entityType, req.entityType));
      }
      const rows = await db
        .select()
        .from(llmInstructions)
        .where(and(...conditions))
        .orderBy(desc(llmInstructions.createdAt));
      return {
        instructions: rows.map(formatLlmInstruction),
      };
    },

    async createLlmInstruction(req) {
      const db = getContext().db;
      if (!req.instruction.trim()) {
        throw new ConnectError('Instruction is required', Code.InvalidArgument);
      }
      const [existing] = await db
        .select()
        .from(llmInstructions)
        .where(
          and(
            eq(llmInstructions.novelId, req.novelId),
            eq(llmInstructions.entityType, req.entityType),
            eq(llmInstructions.instruction, req.instruction),
          ),
        );
      if (existing) {
        return formatLlmInstruction(existing);
      }

      const [row] = await db
        .insert(llmInstructions)
        .values({
          novelId: req.novelId,
          entityType: req.entityType,
          instruction: req.instruction,
        })
        .returning();
      return formatLlmInstruction(row);
    },

    async deleteLlmInstruction(req) {
      const db = getContext().db;
      const [row] = await db
        .delete(llmInstructions)
        .where(eq(llmInstructions.id, req.id))
        .returning();
      if (!row) {
        throw new ConnectError('Instruction not found', Code.NotFound);
      }
      return { success: true };
    },
  });
}
