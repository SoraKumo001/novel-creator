import { sectionClient } from '../grpc-client.js';
import type { Section, SectionWithContent, UpdateSectionInput } from '../types.js';

export async function fetchSection(id: string): Promise<SectionWithContent> {
  const res = await sectionClient.getSection({ id });
  const s = res.section!;
  return {
    id: s.id,
    chapterId: s.chapterId,
    title: s.title ?? null,
    order: s.order,
    summary: s.summary ?? null,
    createdAt: s.createdAt ?? null,
    updatedAt: s.updatedAt ?? null,
    content: res.content
      ? {
          id: res.content.id,
          sectionId: res.content.sectionId,
          body: res.content.body,
          wordCount: res.content.wordCount ?? null,
          createdAt: res.content.createdAt ?? null,
          updatedAt: res.content.updatedAt ?? null,
        }
      : null,
  };
}

export async function updateSection(id: string, input: UpdateSectionInput): Promise<Section> {
  const res = await sectionClient.updateSection({
    id,
    title: input.title,
    order: input.order,
    summary: input.summary,
  });
  return {
    id: res.id,
    chapterId: res.chapterId,
    title: res.title ?? null,
    order: res.order,
    summary: res.summary ?? null,
    createdAt: res.createdAt ?? null,
    updatedAt: res.updatedAt ?? null,
  };
}

export async function deleteSection(id: string): Promise<void> {
  await sectionClient.deleteSection({ id });
}
