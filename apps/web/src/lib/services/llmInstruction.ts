import { llmInstructionClient } from '../grpc-client.js';
import type { CreateLlmInstructionInput, LlmInstruction } from '../types.js';

export async function fetchLlmInstructions(
  novelId: string,
  entityType?: string,
): Promise<LlmInstruction[]> {
  const res = await llmInstructionClient.listLlmInstructions({
    novelId,
    entityType,
  });
  return res.instructions.map((ins) => ({
    id: ins.id,
    novelId: ins.novelId,
    entityType: ins.entityType,
    instruction: ins.instruction,
    createdAt: ins.createdAt ?? null,
  }));
}

export async function createLlmInstruction(
  novelId: string,
  input: CreateLlmInstructionInput,
): Promise<LlmInstruction> {
  const res = await llmInstructionClient.createLlmInstruction({
    novelId,
    entityType: input.entityType,
    instruction: input.instruction,
  });
  return {
    id: res.id,
    novelId: res.novelId,
    entityType: res.entityType,
    instruction: res.instruction,
    createdAt: res.createdAt ?? null,
  };
}

export async function deleteLlmInstruction(id: string): Promise<void> {
  await llmInstructionClient.deleteLlmInstruction({ id });
}
