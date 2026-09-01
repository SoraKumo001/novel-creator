import { apiClient } from "../api-client.js";
import { parseResponseError } from "../errors.js";
import type {
  CreateSettingInput,
  EditInstructionInput,
  EditSettingSectionResult,
  SaveSettingsMarkdownResult,
  Setting,
  SettingDraft,
  SettingDraftInput,
  UpdateSettingInput,
} from "../types.js";

export async function fetchSettings(
  novelId: string,
  category?: string
): Promise<Setting[]> {
  const res = await apiClient.novels[":id"].settings.$get({
    param: { id: novelId },
    query: { category },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "設定一覧の取得");
  }
  const rows = await res.json();
  return rows.map((s) => ({
    id: s.id,
    novelId: s.novelId,
    category: s.category,
    name: s.name,
    description: s.description ?? null,
    metadata: (s.metadata as Record<string, unknown>) ?? {},
    createdAt: s.createdAt ?? null,
    updatedAt: s.updatedAt ?? null,
  }));
}

export async function createSetting(
  novelId: string,
  input: CreateSettingInput
): Promise<Setting> {
  const res = await apiClient.novels[":id"].settings.$post({
    param: { id: novelId },
    json: {
      category: input.category,
      name: input.name,
      description: input.description,
      metadata: input.metadata,
    },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "設定の作成");
  }
  const row = await res.json();
  return {
    id: row.id,
    novelId: row.novelId,
    category: row.category,
    name: row.name,
    description: row.description ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function updateSetting(
  id: string,
  input: UpdateSettingInput
): Promise<Setting> {
  const res = await apiClient.settings[":id"].$put({
    param: { id },
    json: {
      category: input.category,
      name: input.name,
      description: input.description,
      metadata: input.metadata,
    },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "設定の更新");
  }
  const row = await res.json();
  return {
    id: row.id,
    novelId: row.novelId,
    category: row.category,
    name: row.name,
    description: row.description ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function deleteSetting(id: string): Promise<void> {
  const res = await apiClient.settings[":id"].$delete({ param: { id } });
  if (!res.ok) {
    throw await parseResponseError(res, "設定の削除");
  }
}

export async function editSetting(
  id: string,
  input: EditInstructionInput
): Promise<Setting> {
  const res = await apiClient.settings[":id"].edit.$post({
    param: { id },
    json: {
      instruction: input.instruction,
    },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "設定のAI編集");
  }
  const row = await res.json();
  return {
    id: row.id,
    novelId: row.novelId,
    category: row.category,
    name: row.name,
    description: row.description ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function generateSettingDraft(
  novelId: string,
  input: SettingDraftInput
): Promise<SettingDraft> {
  const res = await apiClient.novels[":id"].settings.draft.$post({
    param: { id: novelId },
    json: {
      instruction: input.instruction,
      currentDraft: input.currentDraft,
    },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "設定ドラフトの生成");
  }
  return res.json();
}

export async function fetchSettingsMarkdown(
  novelId: string
): Promise<{ markdown: string }> {
  const res = await apiClient.novels[":id"].settings.markdown.$get({
    param: { id: novelId },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "設定マークダウンの取得");
  }
  return res.json();
}

export async function saveSettingsMarkdown(
  novelId: string,
  markdown: string
): Promise<SaveSettingsMarkdownResult> {
  const res = await apiClient.novels[":id"].settings.markdown.$post({
    param: { id: novelId },
    json: { markdown },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "設定マークダウンの保存");
  }
  return res.json();
}

export async function editSettingSection(
  novelId: string,
  data: {
    category: string;
    name: string;
    description: string;
    instruction: string;
  }
): Promise<EditSettingSectionResult> {
  const res = await apiClient.novels[":id"].settings["edit-section"].$post({
    param: { id: novelId },
    json: data,
  });
  if (!res.ok) {
    throw await parseResponseError(res, "設定セクションのAI編集");
  }
  return res.json();
}

export async function editSettingDocument(
  novelId: string,
  markdown: string,
  instruction: string
): Promise<EditSettingSectionResult> {
  const res = await apiClient.novels[":id"].settings["edit-document"].$post({
    param: { id: novelId },
    json: { markdown, instruction },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "設定ドキュメントのAI編集");
  }
  return res.json();
}
