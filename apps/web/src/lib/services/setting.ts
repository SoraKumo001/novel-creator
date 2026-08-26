import { settingClient } from '../grpc-client.js';
import type {
  CreateSettingInput,
  EditInstructionInput,
  EditSettingSectionResult,
  SaveSettingsMarkdownResult,
  Setting,
  SettingDraft,
  SettingDraftInput,
  UpdateSettingInput,
} from '../types.js';

function parseJsonSafe<T = unknown>(str?: string, defaultValue: unknown = {}): T {
  if (!str) return defaultValue as T;
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue as T;
  }
}

export async function fetchSettings(novelId: string, category?: string): Promise<Setting[]> {
  const res = await settingClient.listSettings({ novelId, category });
  return res.settings.map((s) => ({
    id: s.id,
    novelId: s.novelId,
    category: s.category,
    name: s.name,
    description: s.description ?? null,
    metadata: parseJsonSafe(s.metadataJson),
    createdAt: s.createdAt ?? null,
    updatedAt: s.updatedAt ?? null,
  }));
}

export async function createSetting(novelId: string, input: CreateSettingInput): Promise<Setting> {
  const res = await settingClient.createSetting({
    novelId,
    category: input.category,
    name: input.name,
    description: input.description,
    metadataJson: JSON.stringify(input.metadata ?? {}),
  });
  return {
    id: res.id,
    novelId: res.novelId,
    category: res.category,
    name: res.name,
    description: res.description ?? null,
    metadata: parseJsonSafe(res.metadataJson),
    createdAt: res.createdAt ?? null,
    updatedAt: res.updatedAt ?? null,
  };
}

export async function updateSetting(id: string, input: UpdateSettingInput): Promise<Setting> {
  const res = await settingClient.updateSetting({
    id,
    category: input.category,
    name: input.name,
    description: input.description,
    metadataJson: input.metadata !== undefined ? JSON.stringify(input.metadata) : undefined,
  });
  return {
    id: res.id,
    novelId: res.novelId,
    category: res.category,
    name: res.name,
    description: res.description ?? null,
    metadata: parseJsonSafe(res.metadataJson),
    createdAt: res.createdAt ?? null,
    updatedAt: res.updatedAt ?? null,
  };
}

export async function deleteSetting(id: string): Promise<void> {
  await settingClient.deleteSetting({ id });
}

export async function editSetting(id: string, input: EditInstructionInput): Promise<Setting> {
  const res = await settingClient.editSetting({
    id,
    instruction: input.instruction,
  });
  return {
    id: res.id,
    novelId: res.novelId,
    category: res.category,
    name: res.name,
    description: res.description ?? null,
    metadata: parseJsonSafe(res.metadataJson),
    createdAt: res.createdAt ?? null,
    updatedAt: res.updatedAt ?? null,
  };
}

export async function generateSettingDraft(
  novelId: string,
  input: SettingDraftInput,
): Promise<SettingDraft> {
  const res = await settingClient.generateDraft({
    novelId,
    category: input.currentDraft?.category ?? '',
    query: input.instruction,
  });
  return {
    category: res.category,
    name: res.name,
    description: res.description,
  };
}

export async function fetchSettingsMarkdown(novelId: string): Promise<{ markdown: string }> {
  const res = await settingClient.getSettingsMarkdown({ novelId });
  return { markdown: res.markdown };
}

export async function saveSettingsMarkdown(
  novelId: string,
  markdown: string,
): Promise<SaveSettingsMarkdownResult> {
  const res = await settingClient.saveSettingsMarkdown({ novelId, markdown });
  return {
    created: res.createdCount,
    updated: res.updatedCount,
    deleted: res.deletedCount,
    duplicateCount: 0,
  };
}

export async function editSettingSection(
  novelId: string,
  data: { category: string; name: string; description: string; instruction: string },
): Promise<EditSettingSectionResult> {
  const res = await settingClient.editSettingSection({
    novelId,
    category: data.category,
    name: data.name,
    description: data.description,
    instruction: data.instruction,
  });
  return {
    markdown: res.parsedSummary ?? '',
  };
}

export async function editSettingDocument(
  novelId: string,
  markdown: string,
  instruction: string,
): Promise<EditSettingSectionResult> {
  const res = await settingClient.editSettingDocument({
    novelId,
    markdown,
    instruction,
  });
  return {
    markdown: res.parsedSummary ?? '',
  };
}
