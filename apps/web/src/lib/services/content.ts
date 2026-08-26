import { contentClient } from '../grpc-client.js';
import type { Content, UpdateContentInput } from '../types.js';

export async function fetchContent(sectionId: string): Promise<Content> {
  const res = await contentClient.getContent({ sectionId });
  return {
    id: res.id,
    sectionId: res.sectionId,
    body: res.body,
    wordCount: res.wordCount ?? null,
    createdAt: res.createdAt ?? null,
    updatedAt: res.updatedAt ?? null,
  };
}

export async function updateContent(
  sectionId: string,
  input: UpdateContentInput,
): Promise<Content> {
  const res = await contentClient.updateContent({
    sectionId,
    body: input.body,
  });
  return {
    id: res.id,
    sectionId: res.sectionId,
    body: res.body,
    wordCount: res.wordCount ?? null,
    createdAt: res.createdAt ?? null,
    updatedAt: res.updatedAt ?? null,
  };
}
