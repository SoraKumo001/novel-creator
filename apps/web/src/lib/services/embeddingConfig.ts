import { apiClient } from "../api-client.js";
import { parseResponseError } from "../errors.js";
import type {
  CreateEmbeddingConfigInput,
  EmbeddingConfig,
  TestConnectionResult,
  TestEmbeddingConnectionInput,
  UpdateEmbeddingConfigInput,
} from "../types.js";

export async function fetchEmbeddingConfigs(): Promise<EmbeddingConfig[]> {
  const res = await apiClient["embedding-configs"].$get();
  if (!res.ok) {
    throw await parseResponseError(res, "埋め込み設定一覧の取得");
  }
  const data = await res.json();
  return data;
}

export async function createEmbeddingConfig(
  input: CreateEmbeddingConfigInput
): Promise<EmbeddingConfig> {
  const res = await apiClient["embedding-configs"].$post({
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
  if (!res.ok) {
    throw await parseResponseError(res, "埋め込み設定の作成");
  }
  const data = await res.json();
  return data;
}

export async function updateEmbeddingConfig(
  id: string,
  input: UpdateEmbeddingConfigInput
): Promise<EmbeddingConfig> {
  const res = await apiClient["embedding-configs"][":id"].$put({
    param: { id },
    json: input,
  });
  if (!res.ok) {
    throw await parseResponseError(res, "埋め込み設定の更新");
  }
  const data = await res.json();
  return data;
}

export async function deleteEmbeddingConfig(id: string): Promise<void> {
  const res = await apiClient["embedding-configs"][":id"].$delete({
    param: { id },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "埋め込み設定の削除");
  }
}

export async function setDefaultEmbeddingConfig(
  id: string
): Promise<EmbeddingConfig> {
  const res = await apiClient["embedding-configs"][":id"]["set-default"].$post({
    param: { id },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "デフォルト埋め込み設定の変更");
  }
  const data = await res.json();
  return data;
}

export async function testEmbeddingConfig(
  input: TestEmbeddingConnectionInput
): Promise<TestConnectionResult> {
  const res = await apiClient["embedding-configs"].test.$post({
    json: {
      provider: input.provider,
      modelId: input.modelId,
      dimensions: input.dimensions,
      baseUrl: input.baseUrl || null,
      apiKey: input.apiKey || null,
    },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "埋め込み接続テスト");
  }
  const data = await res.json();
  return data;
}
