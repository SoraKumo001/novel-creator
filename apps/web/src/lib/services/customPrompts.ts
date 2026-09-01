import { parseResponseError } from '../errors.js';
import { apiClient } from '../api-client.js';
import type { CreateCustomPromptInput, CustomPrompt, UpdateCustomPromptInput } from '../types.js';

export async function fetchCustomPrompts(
  novelId?: string | null,
  category?: 'inline' | 'generation' | 'chat' | 'general',
): Promise<CustomPrompt[]> {
  const query: Record<string, string> = {};
  if (novelId) query.novelId = novelId;
  if (category) query.category = category;

  const res = await apiClient['custom-prompts'].$get({
    query,
  });
  if (!res.ok) throw await parseResponseError(res, 'カスタムプロンプト一覧の取得');
  const data = await res.json();
  return data;
}

export async function createCustomPrompt(input: CreateCustomPromptInput): Promise<CustomPrompt> {
  const res = await apiClient['custom-prompts'].$post({
    json: {
      novelId: input.novelId ?? null,
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      category: input.category ?? 'inline',
      systemPrompt: input.systemPrompt ?? null,
      userPrompt: input.userPrompt,
      order: input.order ?? 0,
    },
  });
  if (!res.ok) throw await parseResponseError(res, 'カスタムプロンプトの作成');
  const data = await res.json();
  return data;
}

export async function updateCustomPrompt(
  id: string,
  input: UpdateCustomPromptInput,
): Promise<CustomPrompt> {
  const res = await apiClient['custom-prompts'][':id'].$put({
    param: { id },
    json: input,
  });
  if (!res.ok) throw await parseResponseError(res, 'カスタムプロンプトの更新');
  const data = await res.json();
  return data;
}

export async function deleteCustomPrompt(id: string): Promise<void> {
  const res = await apiClient['custom-prompts'][':id'].$delete({
    param: { id },
  });
  if (!res.ok) throw await parseResponseError(res, 'カスタムプロンプトの削除');
}

export async function seedDefaultCustomPrompts(): Promise<CustomPrompt[]> {
  const res = await apiClient['custom-prompts'].seed.$post();
  if (!res.ok) throw await parseResponseError(res, 'デフォルトプリセットの復元');
  const data = await res.json();
  return data;
}
