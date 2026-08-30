import { parseResponseError } from '../errors.js';
import { apiClient } from '../api-client.js';
import type { CreateLlmInstructionInput, LlmInstruction } from '../types.js';

export async function fetchLlmInstructions(
  novelId: string,
  entityType?: string,
): Promise<LlmInstruction[]> {
  const res = await apiClient.novels[':id']['llm-instructions'].$get({
    param: { id: novelId },
    query: { entityType },
  });
  if (!res.ok) throw await parseResponseError(res, '指示テンプレート一覧の取得');
  const rows = await res.json();
  return rows.map((ins) => ({
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
  const res = await apiClient.novels[':id']['llm-instructions'].$post({
    param: { id: novelId },
    json: {
      entityType: input.entityType,
      instruction: input.instruction,
    },
  });
  if (!res.ok) throw await parseResponseError(res, '指示テンプレートの作成');
  const row = await res.json();
  return {
    id: row.id,
    novelId: row.novelId,
    entityType: row.entityType,
    instruction: row.instruction,
    createdAt: row.createdAt ?? null,
  };
}

export async function deleteLlmInstruction(id: string): Promise<void> {
  const res = await apiClient['llm-instructions'][':id'].$delete({
    param: { id },
  });
  if (!res.ok) throw await parseResponseError(res, '指示テンプレートの削除');
}
