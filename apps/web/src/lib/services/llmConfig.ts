import { apiClient } from '../api-client.js';
import type {
  CreateLLMConfigInput,
  LLMConfig,
  TestConnectionInput,
  TestConnectionResult,
  UpdateLLMConfigInput,
} from '../types.js';

export async function fetchLLMConfigs(): Promise<LLMConfig[]> {
  const res = await apiClient['llm-configs'].$get();
  if (!res.ok) throw new Error('Failed to fetch LLM configs');
  const data = await res.json();
  return data as unknown as LLMConfig[];
}

export async function createLLMConfig(input: CreateLLMConfigInput): Promise<LLMConfig> {
  const res = await apiClient['llm-configs'].$post({
    json: {
      name: input.name,
      provider: input.provider,
      modelId: input.modelId,
      baseUrl: input.baseUrl || null,
      apiKey: input.apiKey || null,
      isDefault: input.isDefault ?? false,
      description: input.description || null,
    },
  });
  if (!res.ok) throw new Error('Failed to create LLM config');
  const data = await res.json();
  return data as unknown as LLMConfig;
}

export async function updateLLMConfig(id: string, input: UpdateLLMConfigInput): Promise<LLMConfig> {
  const res = await apiClient['llm-configs'][':id'].$put({
    param: { id },
    json: input,
  });
  if (!res.ok) throw new Error('Failed to update LLM config');
  const data = await res.json();
  return data as unknown as LLMConfig;
}

export async function deleteLLMConfig(id: string): Promise<void> {
  const res = await apiClient['llm-configs'][':id'].$delete({
    param: { id },
  });
  if (!res.ok) throw new Error('Failed to delete LLM config');
}

export async function setDefaultLLMConfig(id: string): Promise<LLMConfig> {
  const res = await apiClient['llm-configs'][':id']['set-default'].$post({
    param: { id },
  });
  if (!res.ok) throw new Error('Failed to set default LLM config');
  const data = await res.json();
  return data as unknown as LLMConfig;
}

export async function testLLMConfig(input: TestConnectionInput): Promise<TestConnectionResult> {
  const res = await apiClient['llm-configs'].test.$post({
    json: {
      provider: input.provider,
      modelId: input.modelId,
      baseUrl: input.baseUrl || null,
      apiKey: input.apiKey || null,
    },
  });
  if (!res.ok) throw new Error('Failed to test LLM connection');
  const data = await res.json();
  return data as unknown as TestConnectionResult;
}
