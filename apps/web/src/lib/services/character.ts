import { characterClient } from '../grpc-client.js';
import type {
  Character,
  CreateCharacterInput,
  EditCharacterSectionResult,
  EditInstructionInput,
  SaveCharactersMarkdownResult,
  UpdateCharacterInput,
} from '../types.js';

function parseJsonSafe<T = unknown>(str?: string, defaultValue: unknown = {}): T {
  if (!str) return defaultValue as T;
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue as T;
  }
}

export async function fetchCharacters(novelId: string): Promise<Character[]> {
  const res = await characterClient.listCharacters({ novelId });
  return res.characters.map((c) => ({
    id: c.id,
    novelId: c.novelId,
    category: c.category,
    name: c.name,
    description: c.description ?? null,
    traits: c.traits,
    relationships: parseJsonSafe(c.relationshipsJson),
    createdAt: c.createdAt ?? null,
    updatedAt: c.updatedAt ?? null,
  }));
}

export async function createCharacter(
  novelId: string,
  input: CreateCharacterInput,
): Promise<Character> {
  const res = await characterClient.createCharacter({
    novelId,
    category: input.category,
    name: input.name,
    description: input.description,
    traits: input.traits,
    relationshipsJson: JSON.stringify(input.relationships ?? {}),
  });
  return {
    id: res.id,
    novelId: res.novelId,
    category: res.category,
    name: res.name,
    description: res.description ?? null,
    traits: res.traits,
    relationships: parseJsonSafe(res.relationshipsJson),
    createdAt: res.createdAt ?? null,
    updatedAt: res.updatedAt ?? null,
  };
}

export async function updateCharacter(id: string, input: UpdateCharacterInput): Promise<Character> {
  const res = await characterClient.updateCharacter({
    id,
    category: input.category,
    name: input.name,
    description: input.description,
    traits: input.traits,
    relationshipsJson:
      input.relationships !== undefined ? JSON.stringify(input.relationships) : undefined,
  });
  return {
    id: res.id,
    novelId: res.novelId,
    category: res.category,
    name: res.name,
    description: res.description ?? null,
    traits: res.traits,
    relationships: parseJsonSafe(res.relationshipsJson),
    createdAt: res.createdAt ?? null,
    updatedAt: res.updatedAt ?? null,
  };
}

export async function deleteCharacter(id: string): Promise<void> {
  await characterClient.deleteCharacter({ id });
}

export async function editCharacter(id: string, input: EditInstructionInput): Promise<Character> {
  const res = await characterClient.editCharacter({
    id,
    instruction: input.instruction,
  });
  return {
    id: res.id,
    novelId: res.novelId,
    category: res.category,
    name: res.name,
    description: res.description ?? null,
    traits: res.traits,
    relationships: parseJsonSafe(res.relationshipsJson),
    createdAt: res.createdAt ?? null,
    updatedAt: res.updatedAt ?? null,
  };
}

export async function fetchCharactersMarkdown(novelId: string): Promise<{ markdown: string }> {
  const res = await characterClient.getCharactersMarkdown({ novelId });
  return { markdown: res.markdown };
}

export async function saveCharactersMarkdown(
  novelId: string,
  markdown: string,
): Promise<SaveCharactersMarkdownResult> {
  const res = await characterClient.saveCharactersMarkdown({ novelId, markdown });
  return {
    created: res.createdCount,
    updated: res.updatedCount,
    deleted: res.deletedCount,
    duplicateCount: 0,
  };
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
  },
): Promise<EditCharacterSectionResult> {
  const res = await characterClient.editCharacterSection({
    novelId,
    category: data.category,
    name: data.name,
    description: data.description,
    traits: data.traits,
    relationships: data.relationships,
    instruction: data.instruction,
  });
  return {
    markdown: res.parsedSummary ?? '',
  };
}

export async function editCharacterDocument(
  novelId: string,
  markdown: string,
  instruction: string,
): Promise<EditCharacterSectionResult> {
  const res = await characterClient.editCharacterDocument({
    novelId,
    markdown,
    instruction,
  });
  return {
    markdown: res.parsedSummary ?? '',
  };
}
