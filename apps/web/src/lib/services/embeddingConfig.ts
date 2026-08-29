import { apiClient } from '../api-client.js';
import type {
  CreateEmbeddingConfigInput,
  EmbeddingConfig,
  TestEmbeddingConnectionInput,
  TestConnectionResult,
  UpdateEmbeddingConfigInput,
} from '../types.js';

export async function fetchEmbeddingConfigs(): Promise<EmbeddingConfig[]> {
  const res = await apiClient['embedding-configs'].$get();
  if (!res.ok) throw new Error('Failed to fetch Embedding configs');
  const data = await res.json();
  return data as unknown as EmbeddingConfig[];
}

export async function createEmbeddingConfig(
  input: CreateEmbeddingConfigInput,
): Promise<EmbeddingConfig> {
  const res = await apiClient['embedding-configs'].$post({
    json: {
      name: input.name,
      provider: input.provider,
      modelId: input.modelId,
      dimensions: input.dimensions ?? 1536,
      baseUrl: input.baseUrl || null,
      apiKey: input.apiKey || null,
      isDefault: input.isDefault ?? false,
      description: input.description || null,
    },
  });
  if (!res.ok) throw new Error('Failed to create Embedding config');
  const data = await res.json();
  return data as unknown as EmbeddingConfig;
}

export async function updateEmbeddingConfig(
  id: string,
  input: UpdateEmbeddingConfigInput,
): Promise<EmbeddingConfig> {
  const res = await apiClient['embedding-configs'][':id'].$put({
    param: { id },
    json: input,
  });
  if (!res.ok) throw new Error('Failed to update Embedding config');
  const data = await res.json();
  return data as unknown as EmbeddingConfig;
}

export async function deleteEmbeddingConfig(id: string): Promise<void> {
  const res = await apiClient['embedding-configs'][':id'].$delete({
    param: { id },
  });
  if (!res.ok) throw new Error('Failed to delete Embedding config');
}

export async function setDefaultEmbeddingConfig(id: string): Promise<EmbeddingConfig> {
  const res = await apiClient['embedding-configs'][':id']['set-default'].$post({
    param: { id },
  });
  if (!res.ok) throw new Error('Failed to set default Embedding config');
  const data = await res.json();
  return data as unknown as EmbeddingConfig;
}

export async function testEmbeddingConfig(
  input: TestEmbeddingConnectionInput,
): Promise<TestConnectionResult> {
  const res = await apiClient['embedding-configs'].test.$post({
    json: {
      provider: input.provider,
      modelId: input.modelId,
      dimensions: input.dimensions,
      baseUrl: input.baseUrl || null,
      apiKey: input.apiKey || null,
    },
  });
  if (!res.ok) throw new Error('Failed to test Embedding connection');
  const data = await res.json();
  return data as unknown as TestConnectionResult;
}
