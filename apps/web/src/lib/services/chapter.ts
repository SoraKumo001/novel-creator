import { chapterClient, sectionClient } from '../grpc-client.js';
import type {
  Chapter,
  ChapterWithSections,
  CreateChapterInput,
  CreateSectionInput,
  Section,
  UpdateChapterInput,
} from '../types.js';

export async function fetchChapters(novelId: string): Promise<ChapterWithSections[]> {
  const res = await chapterClient.listChapters({ novelId });
  const results: ChapterWithSections[] = [];
  for (const ch of res.chapters) {
    const detail = await chapterClient.getChapter({ id: ch.id });
    const c = detail.chapter!;
    results.push({
      id: c.id,
      novelId: c.novelId,
      title: c.title,
      order: c.order,
      summary: c.summary ?? null,
      createdAt: c.createdAt ?? null,
      updatedAt: c.updatedAt ?? null,
      sections: detail.sections.map((s) => ({
        id: s.id,
        chapterId: s.chapterId,
        title: s.title ?? null,
        order: s.order,
        summary: s.summary ?? null,
        createdAt: s.createdAt ?? null,
        updatedAt: s.updatedAt ?? null,
      })),
    });
  }
  return results;
}

export async function fetchChapter(id: string): Promise<ChapterWithSections> {
  const detail = await chapterClient.getChapter({ id });
  const c = detail.chapter!;
  return {
    id: c.id,
    novelId: c.novelId,
    title: c.title,
    order: c.order,
    summary: c.summary ?? null,
    createdAt: c.createdAt ?? null,
    updatedAt: c.updatedAt ?? null,
    sections: detail.sections.map((s) => ({
      id: s.id,
      chapterId: s.chapterId,
      title: s.title ?? null,
      order: s.order,
      summary: s.summary ?? null,
      createdAt: s.createdAt ?? null,
      updatedAt: s.updatedAt ?? null,
    })),
  };
}

export async function createChapter(novelId: string, input: CreateChapterInput): Promise<Chapter> {
  const res = await chapterClient.createChapter({
    novelId,
    title: input.title,
    order: input.order,
    summary: input.summary,
  });
  return {
    id: res.id,
    novelId: res.novelId,
    title: res.title,
    order: res.order,
    summary: res.summary ?? null,
    createdAt: res.createdAt ?? null,
    updatedAt: res.updatedAt ?? null,
  };
}

export async function updateChapter(id: string, input: UpdateChapterInput): Promise<Chapter> {
  const res = await chapterClient.updateChapter({
    id,
    title: input.title,
    order: input.order,
    summary: input.summary,
  });
  return {
    id: res.id,
    novelId: res.novelId,
    title: res.title,
    order: res.order,
    summary: res.summary ?? null,
    createdAt: res.createdAt ?? null,
    updatedAt: res.updatedAt ?? null,
  };
}

export async function deleteChapter(id: string): Promise<void> {
  await chapterClient.deleteChapter({ id });
}

export async function createSection(
  chapterId: string,
  input: CreateSectionInput,
): Promise<Section> {
  const res = await sectionClient.createSection({
    chapterId,
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
