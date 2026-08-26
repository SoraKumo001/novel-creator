import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import type { llmInstructions } from '@novel-creator/db';
import { LlmInstructionService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';
import { LlmInstructionDomainService, NotFoundError, ValidationError } from '../core/index.js';

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
      const service = new LlmInstructionDomainService(getContext());
      const rows = await service.listInstructions(req.novelId, req.entityType || undefined);
      return {
        instructions: rows.map(formatLlmInstruction),
      };
    },

    async createLlmInstruction(req) {
      const service = new LlmInstructionDomainService(getContext());
      try {
        const row = await service.createInstruction({
          novelId: req.novelId,
          entityType: req.entityType,
          instruction: req.instruction,
        });
        return formatLlmInstruction(row);
      } catch (err) {
        if (err instanceof ValidationError) {
          throw new ConnectError(err.message, Code.InvalidArgument);
        }
        throw err;
      }
    },

    async deleteLlmInstruction(req) {
      const service = new LlmInstructionDomainService(getContext());
      try {
        await service.deleteInstruction(req.id);
        return { success: true };
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },
  });
}
