import { apiClient } from '../api-client.js';
import type { Content, UpdateContentInput } from '../types.js';

export async function fetchContent(sectionId: string): Promise<Content> {
  const res = await apiClient.contents[':id'].$get({ param: { id: sectionId } });
  if (!res.ok) throw new Error('Failed to fetch content');
  const data = await res.json();
  return {
    id: data.id,
    sectionId: data.sectionId,
    body: data.body,
    wordCount: data.wordCount ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function updateContent(
  sectionId: string,
  input: UpdateContentInput,
): Promise<Content> {
  const res = await apiClient.contents[':id'].$put({
    param: { id: sectionId },
    json: {
      body: input.body,
    },
  });
  if (!res.ok) throw new Error('Failed to update content');
  const data = await res.json();
  return {
    id: data.id,
    sectionId: data.sectionId,
    body: data.body,
    wordCount: data.wordCount ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}
