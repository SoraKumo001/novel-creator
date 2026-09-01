import { apiClient } from "../api-client.js";
import { parseResponseError } from "../errors.js";
import type {
  Character,
  CreateCharacterInput,
  EditCharacterSectionResult,
  EditInstructionInput,
  SaveCharactersMarkdownResult,
  UpdateCharacterInput,
} from "../types.js";

export async function fetchCharacters(novelId: string): Promise<Character[]> {
  const res = await apiClient.novels[":id"].characters.$get({
    param: { id: novelId },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "登場人物一覧の取得");
  }
  const rows = await res.json();
  return rows.map((c) => ({
    id: c.id,
    novelId: c.novelId,
    category: c.category,
    name: c.name,
    description: c.description ?? null,
    traits: (c.traits as string[] | null) ?? null,
    relationships: (c.relationships as Record<string, unknown>) ?? {},
    createdAt: c.createdAt ?? null,
    updatedAt: c.updatedAt ?? null,
  }));
}

export async function createCharacter(
  novelId: string,
  input: CreateCharacterInput
): Promise<Character> {
  const res = await apiClient.novels[":id"].characters.$post({
    param: { id: novelId },
    json: {
      category: input.category,
      name: input.name,
      description: input.description,
      traits: input.traits,
      relationships: input.relationships,
    },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "登場人物の作成");
  }
  const row = await res.json();
  return {
    id: row.id,
    novelId: row.novelId,
    category: row.category,
    name: row.name,
    description: row.description ?? null,
    traits: (row.traits as string[] | null) ?? null,
    relationships: (row.relationships as Record<string, unknown>) ?? {},
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function updateCharacter(
  id: string,
  input: UpdateCharacterInput
): Promise<Character> {
  const res = await apiClient.characters[":id"].$put({
    param: { id },
    json: {
      category: input.category,
      name: input.name,
      description: input.description,
      traits: input.traits,
      relationships: input.relationships,
    },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "登場人物の更新");
  }
  const row = await res.json();
  return {
    id: row.id,
    novelId: row.novelId,
    category: row.category,
    name: row.name,
    description: row.description ?? null,
    traits: (row.traits as string[] | null) ?? null,
    relationships: (row.relationships as Record<string, unknown>) ?? {},
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function deleteCharacter(id: string): Promise<void> {
  const res = await apiClient.characters[":id"].$delete({ param: { id } });
  if (!res.ok) {
    throw await parseResponseError(res, "登場人物の削除");
  }
}

export async function editCharacter(
  id: string,
  input: EditInstructionInput
): Promise<Character> {
  const res = await apiClient.characters[":id"].edit.$post({
    param: { id },
    json: {
      instruction: input.instruction,
    },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "登場人物のAI編集");
  }
  const row = await res.json();
  return {
    id: row.id,
    novelId: row.novelId,
    category: row.category,
    name: row.name,
    description: row.description ?? null,
    traits: (row.traits as string[] | null) ?? null,
    relationships: (row.relationships as Record<string, unknown>) ?? {},
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function fetchCharactersMarkdown(
  novelId: string
): Promise<{ markdown: string }> {
  const res = await apiClient.novels[":id"].characters.markdown.$get({
    param: { id: novelId },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "登場人物マークダウンの取得");
  }
  return res.json();
}

export async function saveCharactersMarkdown(
  novelId: string,
  markdown: string
): Promise<SaveCharactersMarkdownResult> {
  const res = await apiClient.novels[":id"].characters.markdown.$post({
    param: { id: novelId },
    json: { markdown },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "登場人物マークダウンの保存");
  }
  return res.json();
}

export async function editCharacterSection(
  novelId: string,
  data: {
    category: string;
    name: string;
    description: string;
    traits: string[];
    relationships: string;
    instruction: string;
  }
): Promise<EditCharacterSectionResult> {
  const res = await apiClient.novels[":id"].characters["edit-section"].$post({
    param: { id: novelId },
    json: data,
  });
  if (!res.ok) {
    throw await parseResponseError(res, "登場人物セクションのAI編集");
  }
  return res.json();
}

export async function editCharacterDocument(
  novelId: string,
  markdown: string,
  instruction: string
): Promise<EditCharacterSectionResult> {
  const res = await apiClient.novels[":id"].characters["edit-document"].$post({
    param: { id: novelId },
    json: { markdown, instruction },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "登場人物ドキュメントのAI編集");
  }
  return res.json();
}
