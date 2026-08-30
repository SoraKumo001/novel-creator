import { apiClient } from '../api-client.js';
import type {
  CreateForeshadowingInput,
  Foreshadowing,
  UpdateForeshadowingInput,
} from '../types.js';

export async function fetchForeshadowings(novelId: string): Promise<Foreshadowing[]> {
  const res = await apiClient.foreshadowings.novel[':novelId'].$get({
    param: { novelId },
  });
  if (!res.ok) throw new Error('Failed to fetch foreshadowings');
  const list = await res.json();
  return list.map((item) => ({
    id: item.id,
    novelId: item.novelId,
    title: item.title,
    category: (item as unknown as { category?: string }).category ?? '未分類',
    description: item.description ?? null,
    status: (item.status as Foreshadowing['status']) ?? 'unresolved',
    placedSectionId: item.placedSectionId ?? null,
    resolvedSectionId: item.resolvedSectionId ?? null,
    createdAt: item.createdAt ? String(item.createdAt) : null,
    updatedAt: item.updatedAt ? String(item.updatedAt) : null,
  }));
}

export async function getForeshadowing(id: string): Promise<Foreshadowing> {
  const res = await apiClient.foreshadowings[':id'].$get({
    param: { id },
  });
  if (!res.ok) throw new Error('Failed to fetch foreshadowing');
  const item = await res.json();
  return {
    id: item.id,
    novelId: item.novelId,
    title: item.title,
    category: (item as unknown as { category?: string }).category ?? '未分類',
    description: item.description ?? null,
    status: (item.status as Foreshadowing['status']) ?? 'unresolved',
    placedSectionId: item.placedSectionId ?? null,
    resolvedSectionId: item.resolvedSectionId ?? null,
    createdAt: item.createdAt ? String(item.createdAt) : null,
    updatedAt: item.updatedAt ? String(item.updatedAt) : null,
  };
}

export async function createForeshadowing(
  novelId: string,
  input: CreateForeshadowingInput,
): Promise<Foreshadowing> {
  const res = await apiClient.foreshadowings.novel[':novelId'].$post({
    param: { novelId },
    json: {
      title: input.title,
      category: input.category,
      description: input.description,
      status: input.status,
      placedSectionId: input.placedSectionId,
      resolvedSectionId: input.resolvedSectionId,
    },
  });
  if (!res.ok) throw new Error('Failed to create foreshadowing');
  const item = await res.json();
  return {
    id: item.id,
    novelId: item.novelId,
    title: item.title,
    category: (item as unknown as { category?: string }).category ?? '未分類',
    description: item.description ?? null,
    status: (item.status as Foreshadowing['status']) ?? 'unresolved',
    placedSectionId: item.placedSectionId ?? null,
    resolvedSectionId: item.resolvedSectionId ?? null,
    createdAt: item.createdAt ? String(item.createdAt) : null,
    updatedAt: item.updatedAt ? String(item.updatedAt) : null,
  };
}

export async function updateForeshadowing(
  id: string,
  input: UpdateForeshadowingInput,
): Promise<Foreshadowing> {
  const res = await apiClient.foreshadowings[':id'].$put({
    param: { id },
    json: {
      title: input.title,
      category: input.category,
      description: input.description,
      status: input.status,
      placedSectionId: input.placedSectionId,
      resolvedSectionId: input.resolvedSectionId,
    },
  });
  if (!res.ok) throw new Error('Failed to update foreshadowing');
  const item = await res.json();
  return {
    id: item.id,
    novelId: item.novelId,
    title: item.title,
    category: (item as unknown as { category?: string }).category ?? '未分類',
    description: item.description ?? null,
    status: (item.status as Foreshadowing['status']) ?? 'unresolved',
    placedSectionId: item.placedSectionId ?? null,
    resolvedSectionId: item.resolvedSectionId ?? null,
    createdAt: item.createdAt ? String(item.createdAt) : null,
    updatedAt: item.updatedAt ? String(item.updatedAt) : null,
  };
}

export async function deleteForeshadowing(id: string): Promise<void> {
  const res = await apiClient.foreshadowings[':id'].$delete({
    param: { id },
  });
  if (!res.ok) throw new Error('Failed to delete foreshadowing');
}

export async function getForeshadowingsMarkdown(novelId: string): Promise<string> {
  const res = await apiClient.novels[':id'].foreshadowings.markdown.$get({
    param: { id: novelId },
  });
  if (!res.ok) throw new Error('Failed to fetch foreshadowings markdown');
  const data = await res.json();
  return data.markdown;
}

export async function saveForeshadowingsMarkdown(
  novelId: string,
  markdown: string,
): Promise<{ created: number; updated: number; deleted: number }> {
  const res = await apiClient.novels[':id'].foreshadowings.markdown.$post({
    param: { id: novelId },
    json: { markdown },
  });
  if (!res.ok) throw new Error('Failed to save foreshadowings markdown');
  return res.json();
}

export async function editForeshadowingDocument(
  novelId: string,
  instruction: string,
  markdown: string,
): Promise<string> {
  const res = await apiClient.novels[':id'].foreshadowings['edit-document'].$post({
    param: { id: novelId },
    json: { instruction, markdown },
  });
  if (!res.ok) throw new Error('Failed to edit foreshadowings document with LLM');
  const data = await res.json();
  return data.markdown;
}

export async function editForeshadowingSection(
  novelId: string,
  section: { category: string; title: string; description: string; status?: string },
  instruction: string,
): Promise<string> {
  const res = await apiClient.novels[':id'].foreshadowings['edit-section'].$post({
    param: { id: novelId },
    json: {
      category: section.category,
      title: section.title,
      description: section.description,
      status: (section.status as Foreshadowing['status']) || 'unresolved',
      instruction,
    },
  });
  if (!res.ok) throw new Error('Failed to edit foreshadowing section with LLM');
  const data = await res.json();
  return data.markdown;
}

export async function generateForeshadowingDraft(
  novelId: string,
  instruction: string,
  currentDraft?: { category?: string; title: string; description?: string; status?: string },
): Promise<{
  category: string;
  title: string;
  description: string;
  status: Foreshadowing['status'];
}> {
  const res = await apiClient.novels[':id'].foreshadowings.draft.$post({
    param: { id: novelId },
    json: {
      instruction,
      currentDraft: currentDraft
        ? {
            category: currentDraft.category,
            title: currentDraft.title,
            description: currentDraft.description,
            status: (currentDraft.status as Foreshadowing['status']) || 'unresolved',
          }
        : undefined,
    },
  });
  if (!res.ok) throw new Error('Failed to generate foreshadowing draft');
  return res.json() as Promise<{
    category: string;
    title: string;
    description: string;
    status: Foreshadowing['status'];
  }>;
}
