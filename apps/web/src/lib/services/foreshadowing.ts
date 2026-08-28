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
    description: item.description ?? null,
    status: (item.status as Foreshadowing['status']) ?? 'unresolved',
    placedSectionId: item.placedSectionId ?? null,
    resolvedSectionId: item.resolvedSectionId ?? null,
    createdAt: item.createdAt ? String(item.createdAt) : null,
    updatedAt: item.updatedAt ? String(item.updatedAt) : null,
  }));
}

export async function createForeshadowing(
  novelId: string,
  input: CreateForeshadowingInput,
): Promise<Foreshadowing> {
  const res = await apiClient.foreshadowings.novel[':novelId'].$post({
    param: { novelId },
    json: {
      title: input.title,
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
